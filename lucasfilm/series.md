---
layout: home
title: Lucasfilm Series
---

{% include now.md %}

[All]({{ "/lucasfilm" | relative_url }}) \| [Movies]({{ "/lucasfilm/movies" | relative_url }}) \| [Series]({{ "/lucasfilm/series" | relative_url }}) 

{% assign items = site.data.releases | where_exp: "item", "item.platform != 'Theaters'" %}
{% assign items = items | where_exp: "item", "item.studio == 'Lucasfilm'" %}

{% include release-list.md %}
