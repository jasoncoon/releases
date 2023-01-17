---
layout: home
title: Marvel Movies
---

{% include now.md %}

[All]({{ "/marvel" | relative_url }}) \| [Movies]({{ "/marvel/movies" | relative_url }}) \| [Series]({{ "/marvel/series" | relative_url }})

{% assign items = site.data.releases | where_exp: "item", "item.platform == 'Theaters'" %}
{% assign items = items | where_exp: "item", "item.studio == 'Marvel'" %}

{% include release-list.md %}