---
layout: home
title: Lucasfilm Releases
---

[All]({{ "/lucasfilm" | relative_url }}) \| [Movies]({{ "/lucasfilm/movies" | relative_url }}) \| [Series]({{ "/lucasfilm/series" | relative_url }}) 

{% assign items = site.data.releases | where_exp: "item", "item.studio == 'Lucasfilm'" %}

| Title | Date | Platform | Notes |
| ----- | ---- | -------- | ----- |
{% for release in items %}| {% if release.link %} [{{ release.title }}]({{ release.link }}) {% else %} {{ release.title }} {% endif %} | {{ release.date }} | {{ release.platform }} | {{ release.notes }} |
{% endfor %}