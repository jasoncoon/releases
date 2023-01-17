---
layout: home
title: All Releases
---

{% include now.md %}

[All]({{ "/" | relative_url }}) \| [Movies]({{ "/movies" | relative_url }}) \| [Series]({{ "/series" | relative_url }})

{% assign items = site.data.releases %}

{% include release-list.md %}