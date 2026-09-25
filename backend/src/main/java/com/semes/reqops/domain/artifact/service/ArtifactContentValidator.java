package com.semes.reqops.domain.artifact.service;

import com.semes.reqops.domain.artifact.entity.ArtifactType;
import com.semes.reqops.global.exception.ApiErrors;
import org.springframework.stereotype.Component;
import java.util.*;

@Component
public class ArtifactContentValidator {
    public void validateDraft(ArtifactType type, Map<String,Object> content){
        if(content==null) throw new ApiErrors.BadRequest("산출물 content가 필요합니다.");
        Set<String> required=switch(type){
            case VOC -> Set.of("requester","requestContent","specialNotes","legacyExtras");
            case FUNCTIONAL, NONFUNCTIONAL -> Set.of("overview","constraintsNote","scenarios","legacyExtras");
            case DETAIL_DESIGN -> Set.of("description","classDiagram","sequenceDiagramAsIs","sequenceDiagramToBe","asIsApplicability","asIsReason","legacyExtras");
        };
        if(!content.keySet().containsAll(required)) throw new ApiErrors.BadRequest(type+" 고정 양식 필드가 누락되었습니다: "+required);
        if(type==ArtifactType.FUNCTIONAL || type==ArtifactType.NONFUNCTIONAL) validateScenarios(content.get("scenarios"));
    }
    public void validateConfirmed(ArtifactType type,Map<String,Object> content){validateDraft(type,content);}
    private void validateScenarios(Object value){
        if(!(value instanceof List<?> rows) || rows.size()!=3) throw new ApiErrors.BadRequest("BASIC/VARIANT/EXCEPTION 시나리오가 각각 하나씩 필요합니다.");
        Set<String> types=new HashSet<>();
        for(Object row:rows){if(!(row instanceof Map<?,?> map) || !(map.get("type") instanceof String t)) throw new ApiErrors.BadRequest("시나리오 type이 필요합니다.");types.add(t);}
        if(!types.equals(Set.of("BASIC","VARIANT","EXCEPTION"))) throw new ApiErrors.BadRequest("시나리오 유형은 BASIC/VARIANT/EXCEPTION이어야 합니다.");
    }
}
