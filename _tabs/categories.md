---
layout: page
title: 카테고리
icon: fas fa-stream
order: 1
---

{% assign names = "개발|CTF/Wargame|Bug Bounty|블로그/기술문서|논문/컨퍼런스|공모전/자격증" | split: "|" %}

<div class="row">
{% for name in names %}
  {% assign posts = site.categories[name] %}
  {% assign count = posts | size %}

  <div class="col-12 mb-3">
    <div class="card">
      <div class="card-body">
        <h3>
          {% if count > 0 %}
            {% capture url %}/categories/{{ name | slugify | url_encode }}/{% endcapture %}
            <a href="{{ url | relative_url }}">{{ name }}</a>
          {% else %}
            {{ name }}
          {% endif %}
        </h3>
        <p class="text-muted mb-0">
          {{ count }}개 게시글
        </p>
      </div>
    </div>
  </div>

{% endfor %}
</div>
