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
  parseChecksums,
  remoteIcons,
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

describe("parseChecksums", () => {
  test("maps each `cksum` line's path to its checksum", () => {
    const out = "123 45 data/space-avatars/sp1-aa.png\n678 9 space-icons/My Repo.svg\n\n";
    expect(parseChecksums(out)).toEqual({ "data/space-avatars/sp1-aa.png": "123", "space-icons/My Repo.svg": "678" });
  });

  test("skips lines that aren't checksums", () => {
    expect(parseChecksums("cksum: space-icons/*: No such file or directory\n")).toEqual({});
    expect(parseChecksums(null)).toEqual({});
  });
});

describe("remoteIcons", () => {
  const sums = {
    "data/space-avatars/sp1-aa.png": "111",
    "space-icons/Herdr.png": "222",
    "space-icons/herdr.svg": "333",
    "space-icons/notes.txt": "444",
  };

  test("maps the machine's per-space icons to local copies named by machine and checksum", () => {
    const r = remoteIcons("10.0.0.5", { sp1: "data/space-avatars/sp1-aa.png" }, sums);
    expect(r.icons).toEqual({ "10.0.0.5/sp1": "data/space-avatars/remote/10_0_0_5-111-sp1-aa.png" });
    expect(r.files["data/space-avatars/remote/10_0_0_5-111-sp1-aa.png"]).toBe("data/space-avatars/sp1-aa.png");
  });

  test("maps its repo icons, preferring types as space-icons/ does", () => {
    const r = remoteIcons("m", {}, sums);
    expect(r.folderIcons).toEqual({ herdr: "data/space-avatars/remote/m-222-Herdr.png" });
    expect(Object.values(r.files)).toEqual(["space-icons/Herdr.png"]);
  });

  test("leaves out icons whose file isn't there or isn't an image", () => {
    const r = remoteIcons("m", { sp2: "data/space-avatars/gone.png", sp3: "../etc/passwd", sp4: 7 }, sums);
    expect(r.icons).toEqual({});
  });
});

describe("resolveIcon with a machine's icons", () => {
  const remote = { icons: { "m/sp1": "data/space-avatars/remote/m-1-a.png" }, folderIcons: { herdr: "data/space-avatars/remote/m-2-herdr.png" } };
  const folderIcons = { herdr: "space-icons/herdr.png", notes: "space-icons/notes.png" };

  test("this computer's own icon for the space still wins", () => {
    expect(resolveIcon({ spaceId: "m/sp1", repo: "herdr", icons: { "m/sp1": "mine.png" }, folderIcons, remote })).toBe("mine.png");
  });

  test("then the machine's icon for the space, then its repo icon, then this computer's", () => {
    expect(resolveIcon({ spaceId: "m/sp1", repo: "herdr", icons: {}, folderIcons, remote })).toBe(remote.icons["m/sp1"]);
    expect(resolveIcon({ spaceId: "m/sp2", repo: "Herdr", icons: {}, folderIcons, remote })).toBe(remote.folderIcons.herdr);
    expect(resolveIcon({ spaceId: "m/sp2", repo: "notes", icons: {}, folderIcons, remote })).toBe("space-icons/notes.png");
  });
});
