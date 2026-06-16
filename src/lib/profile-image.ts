export function normalizeProfileImageUrl(value: string | undefined) {
  if (!value) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("프로필 사진은 올바른 이미지 URL로 입력해 주세요.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("프로필 사진 URL은 http 또는 https로 시작해야 합니다.");
  }

  return url.toString();
}
