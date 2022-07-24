---
layout: home
title: Marvel Releases
---

[All]({{ "/marvel" | relative_url }}) \| [Movies]({{ "/marvel/movies" | relative_url }}) \| [Series]({{ "/marvel/series" | relative_url }}) 

{% assign items = site.data.releases | where_exp: "item", "item.studio == 'Marvel'" %}

| Title | Date | Platform | Notes |
| ----- | ---- | -------- | ----- |
{% for release in items %}| {% if release.link %} [{{ release.title }}]({{ release.link }}) {% else %} {{ release.title }} {% endif %} | {{ release.date }} | {{ release.platform }} | {{ release.notes }} |
{% endfor %}