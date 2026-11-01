import { describe, expect, test } from "bun:test";
import {
  ICON_TYPES,
  DATA_DIR,
  normalizePath,
  iconType,
  hashText,
  avatarFile,
  parseIconListing,
  resolveIcon,
  ownsFile,
  withIcon,
  withoutIcon,
} from "../mods/space-avatars/avatars.js";

const HOME = "/Users/ana";

describe("normalizePath", () => {
  test("trims surrounding whitespace and newlines", () => {
    expect(normalizePath("  /tmp/a.png \n", HOME)).toBe("/tmp/a.png");
  });

  test("expands a leading ~", () => {
    expect(normalizePath("~/Pictures/a.png", HOME)).toBe("/Users/ana/Pictures/a.png");
    expect(normalizePath("~", HOME)).toBe("/Users/ana");
  });

  test("does not expand ~ in the middle or ~user", () => {
    expect(normalizePath("/tmp/~/a.png", HOME)).toBe("/tmp/~/a.png");
    expect(normalizePath("~bob/a.png", HOME)).toBe("~bob/a.png");
  });

  test("strips matching double, single and back quotes", () => {
    expect(normalizePath('"/tmp/my icon.png"', HOME)).toBe("/tmp/my icon.png");
    expect(normalizePath("'/tmp/my icon.png'", HOME)).toBe("/tmp/my icon.png");
    expect(normalizePath("`/tmp/a.png`", HOME)).toBe("/tmp/a.png");
  });

  test("keeps an unmatched quote", () => {
    expect(normalizePath('"/tmp/a.png', HOME)).toBe('"/tmp/a.png');
  });

  test("strips quotes then expands ~", () => {
    expect(normalizePath("'~/a b.png'", HOME)).toBe("/Users/ana/a b.png");
  });

  test("turns a file:// URL into a path and decodes it", () => {
    expect(normalizePath("file:///Users/ana/My%20Icon.png", HOME)).toBe("/Users/ana/My Icon.png");
    expect(normalizePath("file://localhost/tmp/a.png", HOME)).toBe("/tmp/a.png");
  });

  test("turns a Windows file:// URL into a drive path", () => {
    expect(normalizePath("file:///C:/Users/ana/a.png", HOME)).toBe("C:/Users/ana/a.png");
  });

  test("unescapes backslash-escaped spaces from a terminal drag", () => {
    expect(normalizePath("/Users/ana/My\\ Icon\\ (1).png", HOME)).toBe("/Users/ana/My Icon (1).png");
  });

  test("leaves Windows backslash paths alone", () => {
    expect(normalizePath("C:\\Users\\ana\\a.png", HOME)).toBe("C:\\Users\\ana\\a.png");
  });

  test("empty input gives an empty string", () => {
    expect(normalizePath("   ", HOME)).toBe("");
    expect(normalizePath(undefined, HOME)).toBe("");
  });
});

describe("iconType", () => {
  test("accepts every supported type, case-insensitively", () => {
    for (const t of ICON_TYPES) {
      expect(iconType(`/tmp/a.${t}`)).toBe(t);
      expect(iconType(`/tmp/A.${t.toUpperCase()}`)).toBe(t);
    }
  });

  test("rejects other types, no extension and dotfiles", () => {
    expect(iconType("/tmp/a.ico")).toBeNull();
    expect(iconType("/tmp/a.png.txt")).toBeNull();
    expect(iconType("/tmp/png")).toBeNull();
    expect(iconType("/tmp/.png")).toBeNull();
    expect(iconType("/tmp.d/icon")).toBeNull();
    expect(iconType("")).toBeNull();
  });

  test("handles Windows separators", () => {
    expect(iconType("C:\\pics\\a.JPG")).toBe("jpg");
    expect(iconType("C:\\pics.d\\a")).toBeNull();
  });
});

describe("hashText", () => {
  test("is stable, 8 hex chars, and differs for different input", () => {
    expect(hashText("abc")).toBe(hashText("abc"));
    expect(hashText("abc")).toMatch(/^[0-9a-f]{8}$/);
    expect(hashText("abc")).not.toBe(hashText("abd"));
  });
});

describe("avatarFile", () => {
  test("names the copy after the space, a hash and the type", () => {
    const f = avatarFile("s3", "/tmp/a.PNG", 1700000000000);
    expect(f).toMatch(new RegExp(`^${DATA_DIR}/s3-[0-9a-f]{8}\\.png$`));
  });

  test("a new pick of the same file gets a new name", () => {
    expect(avatarFile("s3", "/tmp/a.png", 1)).not.toBe(avatarFile("s3", "/tmp/a.png", 2));
  });

  test("makes remote space ids safe as file names", () => {
    const f = avatarFile("devbox/s7", "/tmp/a.svg", 1);
    expect(f).toMatch(new RegExp(`^${DATA_DIR}/devbox_s7-[0-9a-f]{8}\\.svg$`));
  });

  test("gives null for an unsupported file", () => {
    expect(avatarFile("s3", "/tmp/a.ico", 1)).toBeNull();
  });
});

describe("parseIconListing", () => {
  test("maps lowercased names to space-icons/ paths, preferring earlier types", () => {
    const out = parseIconListing("Herdr.svg\nherdr.png\napi.webp\nnotes.txt\n.png\n\n");
    expect(out).toEqual({ herdr: "space-icons/herdr.png", api: "space-icons/api.webp" });
  });
});

describe("resolveIcon", () => {
  const folderIcons = { herdr: "space-icons/herdr.png" };

  test("a per-space icon wins", () => {
    const icons = { s1: "data/space-avatars/s1-0000abcd.png" };
    expect(resolveIcon({ spaceId: "s1", repo: "herdr", icons, folderIcons })).toBe(icons.s1);
  });

  test("falls back to the repo's folder icon, case-insensitively", () => {
    expect(resolveIcon({ spaceId: "s2", repo: "Herdr", icons: {}, folderIcons })).toBe("space-icons/herdr.png");
  });

  test("gives null when neither is there (the letter tile)", () => {
    expect(resolveIcon({ spaceId: "s2", repo: "other", icons: {}, folderIcons })).toBeNull();
    expect(resolveIcon({ spaceId: "s2", repo: "", icons: null, folderIcons: null })).toBeNull();
  });
});

describe("ownsFile", () => {
  test("only files directly in the data folder are the mod's", () => {
    expect(ownsFile(`${DATA_DIR}/s1-0000abcd.png`)).toBe(true);
    expect(ownsFile("space-icons/herdr.png")).toBe(false);
    expect(ownsFile(`${DATA_DIR}/../settings.json`)).toBe(false);
    expect(ownsFile(`${DATA_DIR}/sub/x.png`)).toBe(false);
    expect(ownsFile(undefined)).toBe(false);
  });
});

describe("withIcon / withoutIcon", () => {
  test("set and remove return new maps", () => {
    const a = { s1: "x" };
    const b = withIcon(a, "s2", "y");
    expect(b).toEqual({ s1: "x", s2: "y" });
    expect(a).toEqual({ s1: "x" });
    expect(withoutIcon(b, "s1")).toEqual({ s2: "y" });
    expect(withoutIcon(null, "s1")).toEqual({});
  });
});
