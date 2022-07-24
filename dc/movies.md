---
layout: home
title: DC Movies
---

[All]({{ "/dc" | relative_url }}) \| [Movies]({{ "/dc/movies" | relative_url }}) \| [Series]({{ "/dc/series" | relative_url }})

{% assign items = site.data.releases | where_exp: "item", "item.platform == 'Theaters'" %}
{% assign items = items | where_exp: "item", "item.studio == 'DC'" %}

| Title | Date | Notes |
| ----- | ---- | ----- |
{% for release in items %}| {% if release.link %} [{{ release.title }}]({{ release.link }}) {% else %} {{ release.title }} {% endif %} | {{ release.date }} | {{ release.notes }} |
{% endfor %}
