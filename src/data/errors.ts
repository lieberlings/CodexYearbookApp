// Thrown when saved data exists but cannot be read, parsed or migrated. Nothing
// is deleted when this happens: the AsyncStorage backup and the database rows
// stay as they were so the user's projects can still be recovered.
export class AppDataLoadError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "AppDataLoadError";
  }
}
