---
layout: home
title: DC Releases
---

{% include now.md %}

[All]({{ "/dc" | relative_url }}) \| [Movies]({{ "/dc/movies" | relative_url }}) \| [Series]({{ "/dc/series" | relative_url }}) 

{% assign items = site.data.releases | where_exp: "item", "item.studio == 'DC'" %}

{% include release-list.md %}