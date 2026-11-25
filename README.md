[![Bounty: $100](https://img.shields.io/badge/Bounty-$100-blue)](https://make.fun/bounty/news-image-20261125)
[![Built for make.fun](https://img.shields.io/badge/Built%20for-make.fun-purple)](https://make.fun)

[![news-image-20261125](https://make.fun/badge/news-image-20261125.svg)](https://make.fun/bounty/news-image-20261125)
[![rank](https://make.fun/badge/news-image-20261125/Mishter-J/news-image-20261125/rank.svg)](https://make.fun/bounty/news-image-20261125)
[![reward](https://make.fun/badge/news-image-20261125/Mishter-J/news-image-20261125/reward.svg)](https://make.fun/bounty/news-image-20261125)

# The World in One Day — Wednesday 25 November 2026

One image that sums up Wednesday 25 November 2026, drawn as a newspaper
front page: a giant date masthead, three lead stories, eight more stories,
a world map with pins, the day in numbers, and a date check that lists the
stories deliberately left out because they happened on 24 November.

## The day's stories

**Leads**

1. **Shenzhou-24 lifts off** (Jiuquan, China, 00:18 UTC) — a Long March-2F
   carries Pakistan's Muhammad Zeeshan Ali beside Tang Hongbo and Wu Yi,
   the 41st crewed Chinese mission, bound for Tiangong. Confirmed by
   Xinhua and the CMSA.
2. **Flinders Island bushfire emergency** (Tasmania, 00:14 UTC) — Tasmania
   Fire Service warns Killiecrankie, Leeka and Mount Tanner: "too late to
   leave", shelter in place. Official.
3. **US Thanksgiving-eve data pile** (13:30 UTC) — Q3 GDP, October PCE,
   durable goods and jobless claims land a day early for the holiday.
   Forecast, from the BEA and the Labor Department.

**Eight more** — Japan's censure motion against the Takaichi cabinet;
South Korea scrambles jets over Russian aircraft near Ulleung Island; the
coalition orders Hodeidah port evacuated; Australia CPI jumps to 4.9%;
Gukesh plays white in World Chess Championship Game 2 in Geneva; the US
widens SE Asia chip curbs; mass strikes sweep Europe and drones hit the
Perm refinery; the Solomon Islands PM says a new treaty elevates
Australia ties. Plus eight more in the "Also on" list: a Seoul Metro
strike averted, Yongbyon expansion, the EU–Western Balkans summit, a NASA
Hubble rescue, the WHO climate-health gap, Putin–Brunei talks, an EU
migration briefing, and a leaked FIFA World Cup fund plan.

19 stories, 6 regions, one day. Every story is dated Wednesday
25 November 2026 (UTC).

## Why the date check matters

The first news searches for "25 November" returned several big stories
that actually happened on Tuesday 24 November: Real Madrid 5-1 PSV,
Zelenskiy's confirmation of the Gulf of Finland strike, the Sarkozy trial
order, the Houthi drone hitting a Riyadh tower, the Hormuz tanker blaze,
the White House turkey pardon, and CAS giving the AFCON title to Senegal.
They are listed in the image's DATE CHECK footer as excluded, not shown
as the day's news — so the image never presents a 24 November event as
a 25 November one.

## How it was built

The front page was drawn with a Python + PIL generator (flat vector-style
illustrations per story, no photographs, no AI-generated imagery): a
1024x1024 layout with a serif masthead, region chips, a UTC timeline,
three lead panels, an 8-story grid, a dotted world map with numbered
pins, a "day in numbers" box, and the date-check footer. Five candidate
layouts were rendered and scored with the local gate and scorer; the
winner passed the gate and scored 89.8/100 (spectacle archetype).

## The program

`main.ts` (Node 22, standard library only) copies the pre-rendered
`entry.png` into the grader's output directory. It runs with no network
and writes the same bytes on every run:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Output: `/output/entry.png` — 1024x1024 JPEG bytes, 441,569 bytes
(under the 1 MiB cap).

## Sources

Xinhua · CMSA · Tasmania Fire Service · ABC News · ABS · BEA · Nikkei
Asia · Al Jazeera · CBS · FIDE · Guardian · Yonhap · AP · WHO · NASA.
Illustrations are drawings.
