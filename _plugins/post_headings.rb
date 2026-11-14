# frozen_string_literal: true

require "nokogiri"

Jekyll::Hooks.register :posts, :post_render do |post|
  next unless post.output_ext == ".html"

  document = Nokogiri::HTML5(post.output)
  body = document.at_css("main article > .content")
  next unless body

  counters = Array.new(7, 0)
  body.css("h2, h3, h4, h5, h6").each do |heading|
    # Chirpy adds a permalink icon. Keep the heading ID for the table of contents.
    heading.css("a.anchor").each do |link|
      link.remove if link.at_css("i.fa-hashtag")
    end
    next if heading.key?("data-toc-skip")

    level = heading.name[1].to_i
    counters[level] += 1
    counters.fill(0, level + 1...counters.length)

    first_text = heading.xpath(".//text()").find { |node| !node.text.strip.empty? }
    next unless first_text

    first_text.content = first_text.text.sub(/\A\s*\d+[.)]\s+/, "")
    heading.prepend_child(Nokogiri::XML::Text.new("#{counters[level]}) ", document))
  end

  post.output = document.to_html
end
