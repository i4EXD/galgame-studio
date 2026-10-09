# Art Templates

Created with the built-in imagegen tool. Original PNG files are preserved here;
`src/art-assets.json` contains offline WebP copies used by the editor and APK.

Rebuild embedded assets:

```sh
node tools/_bake-assets.mjs assets-src/templates src/art-assets.json
```

Prompt set: wide 16:9 anime visual novel background paintings, eye-level,
no people, readable text, logos or UI; lower quarter uncluttered for dialogue.

- `coast.png`: Japanese seaside train station on a clear summer morning,
  turquoise sea, white railings and clouds, bicycle, station bench and vegetation.
- `neon.png`: Japanese side street on a rainy evening, laundromat with warm
  windows, cyan and coral reflections, vending machine, cables and an umbrella.
- `winter.png`: independent bookstore in winter, window overlooking a snowy
  street, white shelves, teal armchair, reading table, red scarf and warm lamp.
