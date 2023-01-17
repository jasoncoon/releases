---
layout: home
title: Lucasfilm Releases
---

{% include now.md %}

[All]({{ "/lucasfilm" | relative_url }}) \| [Movies]({{ "/lucasfilm/movies" | relative_url }}) \| [Series]({{ "/lucasfilm/series" | relative_url }}) 

{% assign items = site.data.releases | where_exp: "item", "item.studio == 'Lucasfilm'" %}

{% include release-list.md %}