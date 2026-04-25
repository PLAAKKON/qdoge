# Grass Battle Prototype

A mobile-first browser prototype inspired by https://github.com/PLAAKKON/grassbattle.

## Features

- 1.5-minute run where 1.5 minutes simulates 4 months of growth
- 3m x 3m lawn represented as a 40 x 25 simulation grid (1,000 simulated blades)
- Each simulated blade represents 100 real blades (effective 100,000 blade behavior)
- Directional light with blade-to-blade shadow interactions
- Score based on total grass centimeters
- End-of-run decoration mode (flowers, butterflies, ladybugs)
- Screenshot save + Web Share support fallback

## Run

You can open `index.html` directly, but serving with a local static server is recommended.

Example using Node:

```bash
npx serve .
```

Then open the local URL on desktop or mobile browser.
