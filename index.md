---
layout: home
title: All Releases
---

[All]({{ "/" | relative_url }}) \| [Movies]({{ "/movies" | relative_url }}) \| [Series]({{ "/series" | relative_url }}) 

| Title | Date | Platform | Studio | Notes |
| ----- | ---- | -------- | ------ | ----- |
{% for release in site.data.releases %}| {% if release.link %} [{{ release.title }}]({{ release.link }}) {% else %} {{ release.title }} {% endif %} | {{ release.date }} | {{ release.platform }} | {{ release.studio }} | {{ release.notes }} |
{% endfor %}