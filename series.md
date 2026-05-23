---
layout: home
title: All Series
---

{% include now.md %}

[All]({{ "/" | relative_url }}) \| [Movies]({{ "/movies" | relative_url }}) \| [Series]({{ "/series" | relative_url }})

{% assign items = site.data.releases | where_exp: "item", "item.platform != 'Theaters'" %}

{% include release-list.md %}
