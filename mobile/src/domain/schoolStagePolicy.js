const SCHOOL_STAGES = Object.freeze({ PRIMARY_MIDDLE: 'primary_middle', SECONDARY: 'secondary' });
const SCHOOL_STAGE_TERMINOLOGY = Object.freeze({
  [SCHOOL_STAGES.PRIMARY_MIDDLE]: Object.freeze({
    classLabel: 'Fasal', classLabelPlural: 'Fasallada', classFieldLabel: 'FASALKA', classPlaceholder: 'tusaale: Fasalka 1', classCodePlaceholder: 'tusaale: G1',
    streamLabel: 'Qayb', streamLabelPlural: 'Qaybaha Fasalka', streamFieldLabel: 'QAYBTA FASALKA', streamPlaceholder: 'tusaale: Qayb A', streamCodePlaceholder: 'tusaale: G1A',
  }),
  [SCHOOL_STAGES.SECONDARY]: Object.freeze({
    classLabel: 'Form', classLabelPlural: 'Formamka', classFieldLabel: 'FORMKA', classPlaceholder: 'tusaale: Form 1', classCodePlaceholder: 'tusaale: F1',
    streamLabel: 'Stream', streamLabelPlural: 'Streams-ka Formka', streamFieldLabel: 'STREAM-KA', streamPlaceholder: 'tusaale: Stream A', streamCodePlaceholder: 'tusaale: F1A',
  }),
});
function terminologyForStage(stage) {
  return SCHOOL_STAGE_TERMINOLOGY[stage] || SCHOOL_STAGE_TERMINOLOGY[SCHOOL_STAGES.PRIMARY_MIDDLE];
}
function applySchoolStageToModule(module, stageOrTerms) {
  const terms = typeof stageOrTerms === 'string' ? terminologyForStage(stageOrTerms) : (stageOrTerms || terminologyForStage(null));
  return {
    ...module,
    title: module.stageTitleKey ? terms[module.stageTitleKey] : module.title,
    single: module.stageSingleKey ? terms[module.stageSingleKey] : module.single,
    fields: (module.fields || []).map((field) => ({
      ...field,
      label: field.stageLabelKey ? terms[field.stageLabelKey] : field.label,
      placeholder: field.stagePlaceholderKey ? terms[field.stagePlaceholderKey] : field.placeholder,
    })),
  };
}
module.exports = { SCHOOL_STAGES, SCHOOL_STAGE_TERMINOLOGY, terminologyForStage, applySchoolStageToModule };
