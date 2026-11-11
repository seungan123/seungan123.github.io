---
layout: default
title: 카테고리
icon: fas fa-stream
order: 1
---

{% include sa-inner/heading.html icon="grid" kicker="SUBJECT SELECT" title=page.title description="분야별 기록을 확인할 수 있습니다." %}
<div class="sa-inner-directory">
{% assign topics = site.pages | where: 'layout', 'topic' | sort: 'topic_order' %}
{% for topic in topics %}
  {% assign records = site.categories[topic.category] | where_exp: 'post', 'post.hidden != true' %}
  <a class="sa-inner-card" href="{{ topic.url | relative_url }}">
    <span class="sa-inner-card-top">
      <span class="sa-inner-card-icon">{% include sa-inner/icon.html name=topic.symbol %}</span>
      <span class="sa-inner-card-count">기록 <span><b>{{ records.size | default: 0 }}</b>건</span></span>
    </span>
    <span class="sa-inner-card-bottom">
      <strong>{{ topic.category | escape }}</strong>
      <span class="sa-inner-card-arrow">{% include sa-inner/icon.html name="arrow-right" %}</span>
    </span>
  </a>
{% endfor %}
</div>
