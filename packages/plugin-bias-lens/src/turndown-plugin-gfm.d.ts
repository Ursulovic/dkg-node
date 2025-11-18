declare module "@joplin/turndown-plugin-gfm" {
  import TurndownService from "turndown";

  export interface Plugin {
    (service: TurndownService): void;
  }

  export const tables: Plugin;
  export const strikethrough: Plugin;
  export const taskListItems: Plugin;
  export const gfm: Plugin;
}
