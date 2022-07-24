---
layout: home
title: All Series
---

[All]({{ "/" | relative_url }}) \| [Movies]({{ "/movies" | relative_url }}) \| [Series]({{ "/series" | relative_url }})

{% assign items = site.data.releases | where_exp: "item", "item.platform != 'Theaters'" %}

| Title | Date | Platform | Studio | Notes |
| ----- | ---- | -------- | ------ | ----- |
{% for release in items %}| {% if release.link %} [{{ release.title }}]({{ release.link }}) {% else %} {{ release.title }} {% endif %} | {{ release.date }} | {{ release.platform }} | {{ release.studio }} | {{ release.notes }} |
{% endfor %}
