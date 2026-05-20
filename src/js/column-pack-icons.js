/**
 * Иконки колонок из пользовательского набора (SVG в `src/assets/column-icons-pack/`).
 * Чтобы обновить список: добавьте/удалите .svg в папке и пересоберите массив (или запустите скрипт в комментарии внизу файла).
 */
export const COLUMN_PACK_ICON_FILES = [
  'AcademicBook.svg',
  'alien-fire.svg',
  'alligator-clip.svg',
  'anvil.svg',
  'archery-target.svg',
  'aura.svg',
  'axe-swing.svg',
  'battered-axe.svg',
  'bear-trap.svg',
  'bird-claw.svg',
  'bleeding-eye.svg',
  'book.svg',
  'broken-skull.svg',
  'candle.svg',
  'castle-flag.svg',
  'Chip.svg',
  'circular-saw.svg',
  'cog.svg',
  'croc-sword.svg',
  'crossed-bones.svg',
  'crown-of-thorns.svg',
  'crown.svg',
  'cut-palm.svg',
  'cycle.svg',
  'daggers.svg',
  'decapitation.svg',
  'diamond.svg',
  'hand.svg',
  'hourglass.svg',
  'ice-cube.svg',
  'large-hammer.svg',
  'perspective-dice-five.svg',
  'perspective-dice-four.svg',
  'perspective-dice-one.svg',
  'perspective-dice-random.svg',
  'perspective-dice-six-two.svg',
  'perspective-dice-six.svg',
  'perspective-dice-three.svg',
  'pill.svg',
  'player-teleport.svg',
  'spades-card.svg',
  'spiked-mace.svg',
  'splash.svg',
  'three-keys.svg'
];

const DEFAULT_PACK_ICON = 'pack:cog';

export function packIconUrl(filename) {
  return new URL(`../assets/column-icons-pack/${filename}`, import.meta.url).href;
}

/** id без «.svg», как в `pack:id` (например cog, AcademicBook, Chip) */
export function resolvePackFilename(storedId) {
  if (!storedId || typeof storedId !== 'string') return null;
  const exact = COLUMN_PACK_ICON_FILES.find((f) => f.replace(/\.svg$/i, '') === storedId);
  if (exact) return exact;
  const low = storedId.toLowerCase();
  return (
    COLUMN_PACK_ICON_FILES.find((f) => f.replace(/\.svg$/i, '').toLowerCase() === low) ||
    COLUMN_PACK_ICON_FILES.find((f) => f.toLowerCase() === `${low}.svg`) ||
    null
  );
}

export function packIconValueFromFilename(filename) {
  return `pack:${filename.replace(/\.svg$/i, '')}`;
}

export function defaultPackColumnIcon() {
  return DEFAULT_PACK_ICON;
}
