/**
 * StoryProgress — which story beats (prologue, chapter cards, cutscenes,
 * boss intros, ending) the player has already seen. Lives in GameSession so
 * it survives zone restarts, and is persisted in the save as `storySeen`.
 */
export class StoryProgress {
  private readonly seen = new Set<string>();

  has(id: string): boolean {
    return this.seen.has(id);
  }

  mark(id: string): void {
    this.seen.add(id);
  }

  toSave(): string[] {
    return [...this.seen];
  }

  load(ids: readonly string[] | undefined): void {
    this.seen.clear();
    for (const id of ids ?? []) this.seen.add(id);
  }
}
