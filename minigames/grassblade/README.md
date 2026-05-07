# GrassBlade

GrassBlade is a browser mini-game about directional plant growth, chlorophyll drops and tactical balance.

## Gameplay

- Every 5 seconds, place a chlorophyll drop on one of the selectable growth cells.
- The blade grows upward while being pulled toward the drop position.
- A center drop gives stable but slower growth.
- A slightly sunward drop gives the best growth.
- A drop that is too far sideways makes the blade weaker and harder to control.
- Each run generates a new procedural cell field, so the best choice shifts over time.

## Features

- Fast, arcade-friendly sessions
- Easy to learn, hard to master directional growth feedback
- Procedural optimal placement each turn
- Local high score tracking in the browser

## Run

Open `index.html` directly in a browser or serve the folder with a local static server for the best experience.

Example using Node:

```bash
npx serve .
```

Then open the local URL and play `minigames/grassblade/index.html`.
