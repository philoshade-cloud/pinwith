export type Visibility = "public" | "unlisted" | "private";
export type ListKind = "collection" | "course";

export type Curator = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  followerCount: number;
};

export type Section = { id: string; name: string; position: number };

export type ListItem = {
  id: string;
  placeId: string;
  title: string;
  memo: string;
  sectionId: string | null;
  position: number;
  tags: string[];
  videoUrl: string | null;
  lat: number | null;
  lng: number | null;
};

export type CuratedList = {
  id: string;
  slug: string;
  title: string;
  description: string;
  visibility: Visibility;
  kind: ListKind;
  themes: string[];
  likeCount: number;
  updatedAt: string;
  curator: Curator;
  // 같은 큐레이터의 다른 리스트(바꿔 보기용)
  siblings?: { slug: string; title: string }[];
  sections: Section[];
  items: ListItem[];
};

export type ListSummary = {
  id: string;
  slug: string;
  title: string;
  visibility: Visibility;
  themes: string[];
  likeCount: number;
  itemCount: number;
  pins: { id: string; title: string; placeId: string; lat: number | null; lng: number | null }[];
};
