export default function WorkflowStepper({step}:{step:1|2|3}){
 const labels=["등록","검토·수정","완료"];
 return <ol className="workflow-steps" aria-label="요구사항 처리 단계">{labels.map((label,i)=><li key={label} className={i+1===step?(step===3?"done":"current"):i+1<step?"done":""} aria-current={i+1===step?"step":undefined}><span>{i+1}</span>{label}</li>)}</ol>;
}
