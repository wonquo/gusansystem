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

export function getProfileImageDisplayUrl(value: string | null | undefined, version?: string | null) {
  if (!value) {
    return null;
  }

  if (!version) {
    return value;
  }

  try {
    const isRelativeUrl = value.startsWith("/");
    const url = new URL(value, "http://profile-image.local");
    if (!isRelativeUrl && (url.protocol !== "http:" && url.protocol !== "https:")) {
      return value;
    }

    // 서명된 URL과 이미지 서비스의 동적 URL은 쿼리 문자열 변경만으로도
    // 접근이 거부될 수 있으므로 캐시 버전을 덧붙이지 않는다.
    if (!isRelativeUrl && url.search) {
      return value;
    }

    url.searchParams.set("v", String(new Date(version).getTime() || version));
    return isRelativeUrl ? `${url.pathname}${url.search}${url.hash}` : url.toString();
  } catch {
    return value;
  }
}
