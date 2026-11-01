# space-avatars

A [Herdr](https://herdr.dev) mod: the Spaces sidebar with a custom image per
space. Right-click a space, **Set icon…**, and paste or drop an image
(png, jpg, jpeg, gif, webp, svg). Spaces without one use
`~/.config/herdr-app/space-icons/<repo>.<ext>`, then Herdr's letter tile.

## Install

1. Copy `mods/space-avatars` to `~/.config/herdr-app/mods/space-avatars`.
2. In your layout (`~/.config/herdr-app/layouts/<name>.json`; for a shipped one,
   `layout.clone` it first), point the `spaces` block at it:

   ```json
   "content": { "mod": "space-avatars" }
   ```

3. `herdr-app check ~/.config/herdr-app/mods/space-avatars`

## Uninstall

Set the block back to `"content": { "mod": "spaces" }`, then delete
`~/.config/herdr-app/mods/space-avatars` and
`~/.config/herdr-app/data/space-avatars`.

## Develop

`bun test` runs the helper tests. `RECIPE.md` describes the mod in full.

MIT license.
