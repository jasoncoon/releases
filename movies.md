---
layout: home
title: All Movies
---

[All]({{ "/" | relative_url }}) \| [Movies]({{ "/movies" | relative_url }}) \| [Series]({{ "/series" | relative_url }})

{% assign items = site.data.releases | where:"platform","Theaters" %}

| Title | Date | Studio | Notes |
| ----- | ---- | ------ | ----- |
{% for release in items %}| {% if release.link %} [{{ release.title }}]({{ release.link }}) {% else %} {{ release.title }} {% endif %} | {{ release.date }} | {{ release.studio }} | {{ release.notes }} |
{% endfor %}
