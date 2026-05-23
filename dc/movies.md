---
layout: home
title: DC Movies
---

{% include now.md %}

[All]({{ "/dc" | relative_url }}) \| [Movies]({{ "/dc/movies" | relative_url }}) \| [Series]({{ "/dc/series" | relative_url }})

{% assign items = site.data.releases | where_exp: "item", "item.platform == 'Theaters'" %}
{% assign items = items | where_exp: "item", "item.studio == 'DC'" %}

{% include release-list.md %}