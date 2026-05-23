---
layout: home
title: All Movies
---

{% include now.md %}

[All]({{ "/" | relative_url }}) \| [Movies]({{ "/movies" | relative_url }}) \| [Series]({{ "/series" | relative_url }})

{% assign items = site.data.releases | where:"platform","Theaters" %}

{% include release-list.md %}