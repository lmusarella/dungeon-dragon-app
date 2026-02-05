export const abilityShortLabel = {
  str: 'FOR',
  dex: 'DES',
  con: 'COS',
  int: 'INT',
  wis: 'SAG',
  cha: 'CAR'
};

export const skillList = [
  { key: 'acrobatics', label: 'Acrobazia', ability: 'dex' },
  { key: 'animal_handling', label: 'Addestrare animali', ability: 'wis' },
  { key: 'arcana', label: 'Arcano', ability: 'int' },
  { key: 'athletics', label: 'Atletica', ability: 'str' },
  { key: 'deception', label: 'Inganno', ability: 'cha' },
  { key: 'history', label: 'Storia', ability: 'int' },
  { key: 'insight', label: 'Intuizione', ability: 'wis' },
  { key: 'intimidation', label: 'Intimidire', ability: 'cha' },
  { key: 'investigation', label: 'Indagare', ability: 'int' },
  { key: 'medicine', label: 'Medicina', ability: 'wis' },
  { key: 'nature', label: 'Natura', ability: 'int' },
  { key: 'perception', label: 'Percezione', ability: 'wis' },
  { key: 'performance', label: 'Intrattenere', ability: 'cha' },
  { key: 'persuasion', label: 'Persuasione', ability: 'cha' },
  { key: 'religion', label: 'Religione', ability: 'int' },
  { key: 'sleight_of_hand', label: 'Rapidità di mano', ability: 'dex' },
  { key: 'stealth', label: 'Furtività', ability: 'dex' },
  { key: 'survival', label: 'Sopravvivenza', ability: 'wis' }
];

export const savingThrowList = [
  { key: 'str', label: 'Forza' },
  { key: 'dex', label: 'Destrezza' },
  { key: 'con', label: 'Costituzione' },
  { key: 'int', label: 'Intelligenza' },
  { key: 'wis', label: 'Saggezza' },
  { key: 'cha', label: 'Carisma' }
];

export const conditionList = [
  {
    key: 'accecato',
    label: 'Accecato',
    effect: 'Fallisce le prove basate sulla vista; attacchi contro con vantaggio, suoi attacchi con svantaggio.'
  },
  {
    key: 'affascinato',
    label: 'Affascinato',
    effect: 'Non può attaccare l’ammaliatore; l’ammaliatore ha vantaggio alle prove sociali.'
  },
  {
    key: 'assordato',
    label: 'Assordato',
    effect: 'Fallisce le prove basate sull’udito.'
  },
  {
    key: 'avvelenato',
    label: 'Avvelenato',
    effect: 'Svantaggio ai tiri per colpire e alle prove di caratteristica.'
  },
  {
    key: 'esausto',
    label: 'Esausto',
    effect: 'I livelli di esaurimento applicano penalità cumulative (vedi regole).'
  },
  {
    key: 'incapacitato',
    label: 'Incapacitato',
    effect: 'Non può compiere azioni o reazioni.'
  },
  {
    key: 'intralciato',
    label: 'Intralciato',
    effect: 'Velocità 0; attacchi contro con vantaggio, suoi attacchi con svantaggio; svantaggio ai TS di Destrezza.'
  },
  {
    key: 'invisibile',
    label: 'Invisibile',
    effect: 'Impossibile da vedere senza mezzi speciali; attacchi contro con svantaggio, suoi attacchi con vantaggio.'
  },
  {
    key: 'paralizzato',
    label: 'Paralizzato',
    effect: 'Incapacitato; non può muoversi o parlare; fallisce TS Forza/Destrezza; attacchi contro con vantaggio e critici in mischia.'
  },
  {
    key: 'pietrificato',
    label: 'Pietrificato',
    effect: 'Incapacitato, non si muove/parla; resistenza a tutti i danni; immunità a veleno e malattie.'
  },
  {
    key: 'privo_di_sensi',
    label: 'Privo di sensi',
    effect: 'Incapacitato; prono; fallisce TS Forza/Destrezza; attacchi contro con vantaggio e critici in mischia.'
  },
  {
    key: 'prono',
    label: 'Prono',
    effect: 'Può solo strisciare; attacchi contro con vantaggio in mischia e svantaggio a distanza; suoi attacchi con svantaggio.'
  },
  {
    key: 'spaventato',
    label: 'Spaventato',
    effect: 'Svantaggio a prove/attacchi mentre la fonte è in vista; non può avvicinarsi volontariamente.'
  },
  {
    key: 'stordito',
    label: 'Stordito',
    effect: 'Incapacitato; non può muoversi; fallisce TS Forza/Destrezza; attacchi contro con vantaggio.'
  },
  {
    key: 'trattenuto',
    label: 'Trattenuto',
    effect: 'Velocità 0; termina se l’afferrante è incapacitato o se la creatura è allontanata.'
  }
];

export const equipmentProficiencyList = [
  { key: 'weapon_simple', label: 'Armi semplici' },
  { key: 'weapon_martial', label: 'Armi da guerra' },
  { key: 'armor_light', label: 'Armature leggere' },
  { key: 'armor_medium', label: 'Armature medie' },
  { key: 'armor_heavy', label: 'Armature pesanti' },
  { key: 'shield', label: 'Scudi' }
];

export const RESOURCE_CAST_TIME_ORDER = [
  { label: 'Sempre attiva', className: 'resource-chip--always' },
  { label: 'Azione Gratuita', className: 'resource-chip--free' },
  { label: 'Azione Bonus', className: 'resource-chip--bonus' },
  { label: 'Reazione', className: 'resource-chip--reaction' },
  { label: 'Azione', className: 'resource-chip--action' }
];
