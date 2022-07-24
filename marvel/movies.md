---
layout: home
title: Marvel Movies
---

[All]({{ "/marvel" | relative_url }}) \| [Movies]({{ "/marvel/movies" | relative_url }}) \| [Series]({{ "/marvel/series" | relative_url }})

{% assign items = site.data.releases | where_exp: "item", "item.platform == 'Theaters'" %}
{% assign items = items | where_exp: "item", "item.studio == 'Marvel'" %}

| Title | Date | Notes |
| ----- | ---- | ----- |
{% for release in items %}| {% if release.link %} [{{ release.title }}]({{ release.link }}) {% else %} {{ release.title }} {% endif %} | {{ release.date }} | {{ release.notes }} |
{% endfor %}
