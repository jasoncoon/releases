{% if items %}

{% assign pastItems = items | where_exp:"item","item.date <= site.time" %}
{% assign pastItems = pastItems | sort: "date", "last" %}

{% assign futureItems = items | where_exp:"item","item.date >= site.time" %}
{% assign futureItems = futureItems | sort: "date", "last" %}

{% if pastItems and pastItems.size != 0 %}

Released:

| Title | Date | Platform | Studio | Notes |
| ----- | ---- | -------- | ------ | ----- |
{% for release in pastItems reversed %}| {% if release.link %} [{{ release.title }}]({{ release.link }}) {% else %} {{ release.title }} {% endif %} | {{ release.release }} | {{ release.platform }} | {{ release.studio }} | {{ release.notes }} |
{% endfor %}

{% endif %}

{% if futureItems and futureItems.size != 0 %}

Upcoming:

| Title | Date | Platform | Studio | Notes |
| ----- | ---- | -------- | ------ | ----- |
{% for release in futureItems %}| {% if release.link %} [{{ release.title }}]({{ release.link }}) {% else %} {{ release.title }} {% endif %} | {{ release.release }} | {{ release.platform }} | {{ release.studio }} | {{ release.notes }} |
{% endfor %}

{% endif %}

{% endif %}
