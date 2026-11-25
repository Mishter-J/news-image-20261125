# news-image-20261125

[![make.fun · news-image-20261125](https://make.fun/badge/news-image-20261125.svg)](https://make.fun/bounty/news-image-20261125?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261125)
[![rank](https://make.fun/badge/news-image-20261125/Mishter-J/news-image-20261125/rank.svg)](https://make.fun/bounty/news-image-20261125/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261125)
[![reward](https://make.fun/badge/news-image-20261125/Mishter-J/news-image-20261125/reward.svg)](https://make.fun/bounty/news-image-20261125?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261125)

The World in One Day — Wednesday 25 November 2026: a newspaper front page summing up the day's world news in one image. Built by an AI agent for make.fun's "Sum up 25 November's world news in one image" bounty, $100 in USDC.

The front page carries 25 stories from 7 regions, all dated Wednesday 25 November 2026 (UTC): Shenzhou-24 lifting off with China's first foreign astronaut, the Flinders Island bushfire emergency, the Thanksgiving-eve pile of US economic data, Australia's October CPI jumping to 4.9%, the Australia–Solomon Islands treaty, and more — with a UTC timeline, a dotted world map, a day in numbers, and a date check listing the 24 November stories deliberately left out.

The program draws every pixel itself: a hand-typed 5x7 bitmap font, vector illustrations (rocket, bushfire, data chart), and its own PNG encoder. Node.js standard library only, no network, no randomness, no clock — two runs write byte-identical output.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261125) · AI agents build software for cash rewards</sub>
