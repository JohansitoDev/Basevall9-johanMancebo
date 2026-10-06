export interface Player {
  id: string;
  name: string;
  number: number;
  position: string;
  power: number;    // 1 to 10
  contact: number;  // 1 to 10
  skinColor: string;
  apodo: string;
}

export interface Team {
  id: 'LIC' | 'AGU';
  name: string;
  shortName: 'AZULES' | 'AMARILLOS';
  clubName: string;
  primaryColor: string;
  secondaryColor: string;
  uniformHex: number;
  capHex: number;
  players: Player[];
}

export const TEAMS: Record<'LIC' | 'AGU', Team> = {
  LIC: {
    id: 'LIC',
    name: 'Tigres Azules',
    shortName: 'AZULES',
    clubName: 'Licey (El Glorioso)',
    primaryColor: '#1d4ed8',
    secondaryColor: '#3b82f6',
    uniformHex: 0x1d4ed8,
    capHex: 0x1e3a8a,
    players: [
      { id: 'lic-1', name: 'El Capi 21', number: 21, position: 'CF', power: 8, contact: 9, skinColor: '#8d5524', apodo: 'El Capitán Azul' },
      { id: 'lic-2', name: 'La Para 34', number: 34, position: 'P / SS', power: 9, contact: 8, skinColor: '#6b3e26', apodo: 'El Lanzallamas' },
      { id: 'lic-3', name: 'El Tiguerón 7', number: 7, position: 'RF', power: 7, contact: 10, skinColor: '#c68642', apodo: 'Toque Mágico' },
      { id: 'lic-4', name: 'Palo Grande 44', number: 44, position: 'DH', power: 10, contact: 7, skinColor: '#5c3317', apodo: 'Sacapalos del Quisqueya' },
      { id: 'lic-5', name: 'El Menor 12', number: 12, position: '2B', power: 6, contact: 9, skinColor: '#a16638', apodo: 'Correcaminos' },
      { id: 'lic-6', name: 'Bate Caliente 99', number: 99, position: '1B', power: 10, contact: 8, skinColor: '#7a4b2a', apodo: 'Jonronero Mayor' },
      { id: 'lic-7', name: 'La Melaza 5', number: 5, position: '3B', power: 8, contact: 8, skinColor: '#8d5524', apodo: 'Guante de Seda' },
      { id: 'lic-8', name: 'ManguPower 27', number: 27, position: 'LF', power: 9, contact: 7, skinColor: '#5c3317', apodo: 'PuroTresGolpes' },
      { id: 'lic-9', name: 'El Candado 18', number: 18, position: 'C', power: 7, contact: 8, skinColor: '#b57845', apodo: 'Receptor Estrella' },
    ],
  },
  AGU: {
    id: 'AGU',
    name: 'Águilas Amarillas',
    shortName: 'AMARILLOS',
    clubName: 'Amarillos del Cibao',
    primaryColor: '#eab308',
    secondaryColor: '#facc15',
    uniformHex: 0xeab308,
    capHex: 0xca8a04,
    players: [
      { id: 'agu-1', name: 'El Cibaeño 10', number: 10, position: 'CF', power: 8, contact: 8, skinColor: '#8d5524', apodo: 'Orgullo de Santiago' },
      { id: 'agu-2', name: 'Plátano Power 23', number: 23, position: 'SS', power: 9, contact: 7, skinColor: '#5c3317', apodo: 'Palo por el Medio' },
      { id: 'agu-3', name: 'La Guagua 40', number: 40, position: '1B', power: 10, contact: 6, skinColor: '#6b3e26', apodo: 'No lo para nadie' },
      { id: 'agu-4', name: 'El Aguilucho 15', number: 15, position: 'P / RF', power: 7, contact: 9, skinColor: '#b57845', apodo: 'Curva Venenosa' },
      { id: 'agu-5', name: 'Sancocho 55', number: 55, position: 'DH', power: 9, contact: 7, skinColor: '#7a4b2a', apodo: 'Siete Carnes' },
      { id: 'agu-6', name: 'El Rápido 2', number: 2, position: '2B', power: 5, contact: 10, skinColor: '#c68642', apodo: 'Roba Bases' },
      { id: 'agu-7', name: 'Brazo de Oro 31', number: 31, position: '3B', power: 8, contact: 7, skinColor: '#8d5524', apodo: 'Cañón en Tercera' },
      { id: 'agu-8', name: 'El Coro 8', number: 8, position: 'LF', power: 7, contact: 8, skinColor: '#6b3e26', apodo: 'Bulla en el Bleacher' },
      { id: 'agu-9', name: 'La Muralla 19', number: 19, position: 'C', power: 6, contact: 8, skinColor: '#9c6137', apodo: 'Bloquea Todo' },
    ],
  },
};

export interface ShopItem {
  id: string;
  name: string;
  category: string;
  bonus: string;
  tag: string;
}

export const SHOP_ITEMS_PREVIEW: ShopItem[] = [
  {
    id: 'bat-guayaba',
    name: 'Bate de Guayaba Criolla',
    category: 'Bate Especial',
    bonus: '+2 Power en el Quisqueya',
    tag: 'Solo Visual V1',
  },
  {
    id: 'glove-glorioso',
    name: 'Guante Azul del Glorioso',
    category: 'Defensa',
    bonus: '+2 Contacto y Fildeo',
    tag: 'Solo Visual V1',
  },
  {
    id: 'chain-figaro',
    name: 'Cadena Gruesa de Pelotero',
    category: 'Flow Dominicano',
    bonus: '+15% Pikete en Home Run',
    tag: 'Solo Visual V1',
  },
  {
    id: 'corneta-licey',
    name: 'Corneta de Bleacher RD',
    category: 'Animación',
    bonus: 'Doble Bulla en el Estadio',
    tag: 'Solo Visual V1',
  },
];
