---
layout: home
title: Movies
---

{% assign movies = site.data.releases | where:"platform","Theaters" %}

| Title | Date | Notes |
| ----- | ---- | ----- |
{% for release in movies %}| {% if release.link %} [{{ release.title }}]({{ release.link }}) {% else %} {{ release.title }} {% endif %} | {{ release.date }} | {{ release.type }} |
{% endfor %}