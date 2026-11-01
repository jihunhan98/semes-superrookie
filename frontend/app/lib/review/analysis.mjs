const warningLabels={
 INVALID_RESPONSE:'AI 응답의 JSON 형식 또는 원문·수정안 검증을 통과하지 못했습니다.',
 INVALID_FINDING:'AI가 반환한 원문 구절 또는 수정안이 입력 본문과 일치하지 않습니다.',
 TIMEOUT:'AI 응답 대기시간을 초과했습니다.',
 BATCH_FAILED:'일부 요구사항의 AI 검토 중 오류가 발생했습니다.',
 SOURCE_TOO_LONG:'일부 원문 구절이 검토 가능한 길이를 초과했습니다.',
};
export function analysisNotice(requirement){
 if(!requirement.reviewContext)return '';
 if(requirement.aiEngine==='unavailable')return 'AI 서버 응답을 받거나 해석하지 못했습니다. 입력 내용은 유지됩니다. AI 다시 분석을 실행해주세요.';
 const context=requirement.reviewContext;
 if(!['PARTIAL','FAILED'].includes(context.status))return '';
 const reasons=[...new Set((context.reviewWarnings??[]).map(code=>warningLabels[code]??'AI 검토 중 오류가 발생했습니다.'))];
 const counts=context.totalCount>0?` 기존 요구사항 비교 ${context.comparedCount}/${context.totalCount}건 완료.`:'';
 return `${context.status==='PARTIAL'?'AI 분석을 일부만 완료했습니다.':'AI 분석을 완료하지 못했습니다.'}${counts} ${reasons.join(' ')||'응답에 완료된 분석 결과가 없거나 일부 결과가 검증을 통과하지 못했습니다.'} 표시된 제안은 검토할 수 있습니다. 요구사항 확정 전 AI 다시 분석을 실행해주세요.`;
}
