---
layout: home
title: Series
---

{% assign series = site.data.releases | where:"platform","Disney+" %}

| Title | Date | Notes |
| ----- | ---- | ----- |
{% for release in series %}| {% if release.link %} [{{ release.title }}]({{ release.link }}) {% else %} {{ release.title }} {% endif %} | {{ release.date }} | {{ release.type }} |
{% endfor %}