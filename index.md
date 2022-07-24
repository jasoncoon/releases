---
layout: home
---

| Title | Date | Platform | Notes |
| ----- | ---- | -------- | ----- |
{% for release in site.data.releases %}| {% if release.link %} [{{ release.title }}]({{ release.link }}) {% else %} {{ release.title }} {% endif %} | {{ release.date }} | {{ release.platform }} | {{ release.type }} |
{% endfor %}