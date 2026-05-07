export type Note = {
  id: string;
  title: string;
  folder: string;
  date: string;
  preview: string;
  starred: boolean;
  body: string;
};

export type TocEntry = {
  level: number;
  text: string;
  id: string;
};

export type Tab = {
  id: string;
  title: string;
};
