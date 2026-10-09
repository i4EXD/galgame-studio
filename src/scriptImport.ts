import { uid, type Character, type Line } from './types';

export function parseScript(text: string, chapterId: string, characters: Character[]): Line[] {
  const byName = new Map(characters.map(character => [character.name.trim(), character.id]));
  return text.replace(/^\uFEFF/, '').split(/\r?\n/).map(row => row.trim()).filter(Boolean).map(row => {
    const match = /^([^:：]{1,40})[:：]\s*(.*)$/.exec(row);
    const name = match?.[1].trim() || '';
    const recognized = name === '旁白' || byName.has(name);
    const speakerId = recognized ? byName.get(name) || null : null;
    return {
      id: uid('ln'), chapterId, speakerId,
      text: recognized ? match![2] : row,
      expressionId: '', presentation: speakerId ? 'sprite' : 'background', cgAssetId: '',
    };
  });
}
