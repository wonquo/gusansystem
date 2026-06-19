import type { AppUserRole, AppUserStatus, CustomerOptionType } from "@/db/schema";

export const CUSTOMER_EMPTY_FACET = "__empty__";

export type CustomerDashboardFilter = "open" | "callbacks" | "contacted";

export type AppUserRow = {
  id: string;
  employeeCode: string | null;
  loginId: string;
  email: string;
  name: string;
  profileImageUrl: string | null;
  role: AppUserRole;
  status: AppUserStatus;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerRow = {
  id: string;
  source: string;
  salesPotential: string | null;
  phone: string;
  gender: string | null;
  ageDecade: string | null;
  status: string | null;
  callNote: string | null;
  lastContactedAt: string | null;
  lastContactedLabel: string | null;
  orderNote: string | null;
  remark: string | null;
  tags: string[];
  assignedUserId: string | null;
  assignedUserName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerFacets = {
  sources: string[];
  salesPotentials: string[];
  statuses: string[];
  sourceOptions: string[];
  salesPotentialOptions: string[];
  statusOptions: string[];
  genders: string[];
  ageDecades: string[];
  owners: string[];
};

export type CustomerSortKey =
  | "source"
  | "salesPotential"
  | "phone"
  | "gender"
  | "ageDecade"
  | "status"
  | "lastContacted"
  | "callNote"
  | "orderNote"
  | "remark";

export type CustomerPageInfo = {
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  returned: number;
  totalCount: number;
};

export type CustomerPageResult = {
  rows: CustomerRow[];
  pageInfo: CustomerPageInfo;
};

export type CustomerContactMethod = "call" | "sms";

export type CustomerActivityRow = {
  id: string;
  customerId: string;
  method: CustomerContactMethod;
  occurredAt: string;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type CustomerOptionRow = {
  id: string;
  type: CustomerOptionType;
  label: string;
  sortOrder: number;
  isActive: boolean;
  usageCount: number;
  isManaged: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type NoticeRow = {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  popupEnabled: boolean;
  popupStartsAt: string | null;
  popupEndsAt: string | null;
  createdBy: string | null;
  authorName: string | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
};

export type NoticeCommentRow = {
  id: string;
  noticeId: string;
  content: string;
  createdBy: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NoticeDetailRow = NoticeRow & {
  comments: NoticeCommentRow[];
};

export type BoardAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
};

export type BoardPostRow = {
  id: string;
  title: string;
  content: string;
  category: string;
  attachments: BoardAttachment[];
  createdBy: string | null;
  authorName: string | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
};

export type BoardCommentRow = {
  id: string;
  postId: string;
  content: string;
  attachments: BoardAttachment[];
  createdBy: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BoardPostDetailRow = BoardPostRow & {
  comments: BoardCommentRow[];
};

export type MemoRow = {
  id: string;
  title: string;
  content: string;
  attachments: BoardAttachment[];
  createdBy: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CalendarEventCategory = "휴가" | "출장" | "회의" | "교육" | "외근" | "기타";

export type CalendarEventAttendee = {
  id: string;
  name: string;
  email: string | null;
};

export type CalendarEventRow = {
  id: string;
  title: string;
  category: CalendarEventCategory;
  eventDate: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  location: string | null;
  note: string | null;
  attendees: CalendarEventAttendee[];
  createdBy: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkDiaryDestinationRow = {
  id: string;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  usageCount: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type WorkDiaryTypeRow = {
  id: string;
  code: string;
  label: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  usageCount: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type WorkDiaryRow = {
  id: string;
  userId: string;
  userName: string;
  workDate: string;
  workType: string;
  workTypeId: string | null;
  workTypeCode: string | null;
  workTypeLabel: string | null;
  workTypeColor: string | null;
  primaryWork: string;
  secondaryWork: string;
  destinationId: string | null;
  destinationCode: string | null;
  destinationLabel: string | null;
  memo: string;
  sortOrder: number;
  isPlaceholder: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};
