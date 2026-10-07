"""Source-grounded evidence and deterministic validation. Never execute uploaded code."""
from __future__ import annotations
import hashlib
import importlib
import json
import os
import re
from pathlib import PurePosixPath

MAX_CONTEXT = int(os.getenv('AI_MAX_CONTEXT_CHARS', '120000'))

def checked_context(value):
    text = json.dumps(value, ensure_ascii=False)
    if len(text) > MAX_CONTEXT:
        raise ValueError(f'전체 입력 {len(text):,}자가 AI_MAX_CONTEXT_CHARS={MAX_CONTEXT:,}를 초과했습니다. 요구사항을 생략하지 않았습니다.')
    return text


def index_sources(files, version):
    from tree_sitter import Language, Parser
    languages = {'.cpp':'cpp', '.cc':'cpp', '.cxx':'cpp', '.h':'cpp', '.hpp':'cpp', '.java':'java', '.cs':'c_sharp', '.py':'python'}
    if not version.strip() or not files or len(files) > 100:
        raise ValueError('소스 버전과 1~100개의 파일이 필요합니다.')
    if sum(len(f['content'].encode()) for f in files) > 2_000_000:
        raise ValueError('소스 묶음은 2MB 이하여야 합니다.')
    symbols, warnings, seen, deferred = [], [], set(), []
    classes = {'class_definition','class_declaration','class_specifier','struct_specifier','interface_declaration','struct_declaration','record_declaration'}
    methods = {'method_declaration','constructor_declaration','function_definition'}
    def walk(node):
        yield node
        for child in node.named_children:
            yield from walk(child)
    for file in files:
        path = file['path'].replace('\\', '/')
        if path in seen or PurePosixPath(path).is_absolute() or '..' in PurePosixPath(path).parts:
            raise ValueError('중복 또는 유효하지 않은 상대 파일 경로입니다.')
        seen.add(path)
        lang = languages.get(PurePosixPath(path).suffix.lower())
        if not lang:
            raise ValueError(f'지원하지 않는 소스 확장자: {path}')
        source = file['content'].encode()
        parser = Parser(Language(importlib.import_module('tree_sitter_' + lang).language()))
        tree = parser.parse(source)
        if tree.root_node.has_error:
            warnings.append(f'{path}: 구문 분석 오류가 있어 일부 심볼·관계가 누락될 수 있습니다.')
        def text(node): return source[node.start_byte:node.end_byte].decode() if node else ''
        class_nodes = {}
        for node in walk(tree.root_node):
            if node.type not in classes: continue
            name = text(node.child_by_field_name('name'))
            if not name: continue
            sid = hashlib.sha256(f'{version}:{path}:{node.start_byte}'.encode()).hexdigest()[:20]
            parents = []
            parent = node.parent
            while parent:
                if parent.type in classes or parent.type in {'namespace_definition','namespace_declaration'}:
                    pn = text(parent.child_by_field_name('name'))
                    if pn: parents.insert(0, pn)
                parent = parent.parent
            qualified = '::'.join(parents + [name])
            if lang == 'java':
                package = next((text(x).removeprefix('package ').rstrip(';').strip() for x in tree.root_node.named_children if x.type == 'package_declaration'), '')
                qualified = (package + '.' if package else '') + qualified.replace('::','.')
            entry = dict(id=sid, name=name, qualifiedName=qualified, kind='CLASS', file=path, line=node.start_point.row+1, endLine=node.end_point.row+1, code=text(node), methods=[], fields=[], bases=[])
            class_nodes[node.start_byte] = entry
            symbols.append(entry)
            for child in node.named_children:
                if child.type in {'base_class_clause','superclass','super_interfaces','base_list','argument_list'}:
                    entry['bases'].append(text(child))
        for node in walk(tree.root_node):
            if node.type not in methods and node.type not in {'field_declaration','declaration'}: continue
            parent = node.parent
            owner = None
            while parent:
                if parent.start_byte in class_nodes and parent.type in classes:
                    owner = class_nodes[parent.start_byte]; break
                parent = parent.parent
            is_method_declaration = node.type in {'field_declaration','declaration'} and any(x.type == 'function_declarator' for x in walk(node))
            if node.type in {'field_declaration','declaration'} and not is_method_declaration:
                if owner and node.parent and node.parent.type in {'field_declaration_list','class_body','declaration_list'}:
                    owner['fields'].append(text(node))
                continue
            name_node = node.child_by_field_name('name')
            declarator = node.child_by_field_name('declarator')
            if name_node is None and declarator is not None:
                fn = next((x for x in walk(declarator) if x.type == 'function_declarator'), None)
                name_node = fn.child_by_field_name('declarator') if fn else None
            name = text(name_node)
            if not name: continue
            if not owner and '::' in name:
                owner_name = name.rsplit('::',1)[0]
                owner = next((s for s in symbols if s['qualifiedName'] == owner_name or s['name'] == owner_name), None)
            owner_name = name.rsplit('::',1)[0] if '::' in name else None
            if not owner and not owner_name: continue
            body = node.child_by_field_name('body')
            calls = [dict(expression=text(x), line=x.start_point.row+1, resolution='UNRESOLVED') for x in walk(node) if x.type in {'call_expression','method_invocation','invocation_expression','call'}]
            method = dict(id=hashlib.sha256(f'{version}:{path}:method:{node.start_byte}'.encode()).hexdigest()[:20], name=name.split('::')[-1], signature=source[node.start_byte:(body.start_byte if body else node.end_byte)].decode().strip(), file=path, line=node.start_point.row+1, endLine=node.end_point.row+1, code=text(node), calls=calls)
            if owner: owner['methods'].append(method)
            else: deferred.append((owner_name,method))
    for owner_name,method in deferred:
        owners = [s for s in symbols if s['qualifiedName'] == owner_name or s['name'] == owner_name]
        if len(owners) == 1: owners[0]['methods'].append(method)
        else: warnings.append(f'{owner_name}: 외부 메서드의 소속 클래스를 확정하지 못했습니다.')
    if not symbols:
        raise ValueError('클래스를 찾지 못했습니다. 클래스 정의가 포함된 소스를 등록해 주세요.')
    return dict(version=version, files=[dict(path=f['path'], hash=hashlib.sha256(f['content'].encode()).hexdigest()) for f in files], symbols=symbols, warnings=warnings, relationPolicy='정적 호출 표현식만 추출합니다. 동적 호출·콜백의 실행 순서는 미확인입니다.')


def missing_design(reason):
    return dict(description=reason, classDiagram=None, sequenceDiagramAsIs=None, sequenceDiagramToBe=None, asIsApplicability='UNKNOWN', asIsReason=reason, legacyExtras={})


def render_design(content, snapshot):
    """Only registered symbols may become diagram nodes/method calls."""
    symbols = {s['id']: s for s in snapshot.get('symbols', [])}
    model = content.get('diagramModel')
    if not isinstance(model, dict): raise ValueError('코드 심볼 기반 diagramModel이 없습니다.')
    ids = model.get('classIds', [])
    if not ids or len(ids) != len(set(ids)) or any(i not in symbols for i in ids):
        raise ValueError('등록되지 않은 클래스 또는 중복 클래스가 있습니다.')
    aliases = {sid:f'C{i}' for i,sid in enumerate(ids)}
    safe = lambda s: re.sub(r'[^\w .:()<>%,=+*/-]', ' ', str(s)).strip()
    lines = ['classDiagram']
    for sid in ids:
        s = symbols[sid]
        lines.append(f'    class {aliases[sid]}["{safe(s["qualifiedName"])}"]')
        for m in s['methods']:
            lines.append(f'    {aliases[sid]} : {safe(m["name"])}()')
    # Statically declared inheritance and fields retain their actual source names.
    for sid in ids:
        for field in symbols[sid].get('fields', []):
            lines.append(f'    {aliases[sid]} : {safe(field)}')
        for base in symbols[sid].get('bases', []):
            tokens = re.findall(r'[A-Za-z_]\w*', base)
            for other in ids:
                if other != sid and symbols[other]['name'] in tokens:
                    lines.append(f'    {aliases[other]} <|-- {aliases[sid]} : 선언된 상속')
    for sid in model.get('changedClassIds', []):
        if sid not in aliases: raise ValueError('변경 클래스 참조 오류')
        lines.append(f'    style {aliases[sid]} fill:#edf3ff,stroke:#3c68d9,stroke-width:2px')
    # Relations are explicit proposals, not falsely certified static dependencies.
    for edge in model.get('relations', []):
        if edge.get('from') not in aliases or edge.get('to') not in aliases: raise ValueError('클래스 관계 참조 오류')
        lines.append(f'    {aliases[edge["from"]]} --> {aliases[edge["to"]]} : {safe(edge.get("reason", "의존 관계 검토"))} (제안)')
    content['classDiagram'] = '\n'.join(lines)
    for key, out in [('before','sequenceDiagramAsIs'),('after','sequenceDiagramToBe')]:
        seq = ['sequenceDiagram'] + [f'    participant {aliases[sid]} as {safe(symbols[sid]["qualifiedName"])}' for sid in ids]
        steps = model.get(key, [])
        if not steps:
            seq.append(f'    Note over {aliases[ids[0]]}: 처리 흐름 근거 부족')
        for step in steps:
            a,b = step.get('from'),step.get('to')
            if a not in aliases or b not in aliases: raise ValueError('시퀀스 클래스 참조 오류')
            method = next((m for m in symbols[b]['methods'] if m['id'] == step.get('methodId')), None)
            if not method: raise ValueError('대상 클래스에 없는 메서드입니다.')
            evidence = step.get('evidence', '')
            if key == 'before' and (not evidence or method['name'] not in evidence or not any(evidence in m['code'] for m in symbols[a]['methods'])):
                raise ValueError('변경 전 호출 근거가 호출 클래스 코드에 없습니다.')
            seq.append(f'    {aliases[a]}->>{aliases[b]}: {safe(method["name"])}()')
            seq.append(f'    Note right of {aliases[b]}: {safe(step.get("reason", ""))} ({"정적 근거, 실행순서 확인 필요" if key == "before" else "변경 제안"})')
        content[out] = '\n'.join(seq)
    content['asIsApplicability'] = 'UNKNOWN'
    content['asIsReason'] = '소스 정적 근거를 표시했습니다. 동적 바인딩·이벤트·실제 실행 순서는 별도 확인이 필요합니다.'
    content['legacyExtras'] = content.get('legacyExtras') or {}
    content['legacyExtras']['codeEvidence'] = [dict(id=sid, name=symbols[sid]['qualifiedName'], file=symbols[sid]['file'], line=symbols[sid]['line'], version=snapshot['version']) for sid in ids]
    return content


def validate_evidence(content, sources):
    evidence = content.get('evidence', [])
    errors = []
    if not isinstance(evidence, list) or not evidence:
        return ['산출물 필드별 원문 근거가 없습니다.']
    for item in evidence:
        if not isinstance(item, dict): errors.append('근거 형식 오류'); continue
        quote = item.get('quote','')
        if item.get('reqKey') not in sources or not quote or quote not in sources[item['reqKey']]:
            errors.append('원문에 없는 근거 구절 또는 요구사항 ID입니다.')
        path = item.get('field','')
        current = content
        try:
            for part in path.split('.'):
                current = current[int(part)] if isinstance(current, list) else current[part]
        except (KeyError, TypeError, ValueError, IndexError): errors.append(f'존재하지 않는 산출물 필드: {path}')
    return errors


def numeric_concerns(content, source):
    # Units included: 30% and 0.3% are deliberately distinct.
    pattern = r'\d+(?:\.\d+)?\s*(?:%|ms|초|분|mm|cm|m/s)(?:\s*(?:이상|이하|초과|미만))?'
    normalize = lambda s: re.sub(r'\s+', '', s)
    known = {normalize(x) for x in re.findall(pattern, source)}
    found = {normalize(x) for x in re.findall(pattern, json.dumps(content, ensure_ascii=False))}
    return [f'수치·단위·경계 조건의 근거 확인 필요: {x}' for x in sorted(found-known)]
