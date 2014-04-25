/**
 * Implements hook_entity_post_render_content().
 */
function rate_entity_post_render_content(entity, entity_type, bundle) {
  try {
    // Since the rate widget isn't a field, we'll append/prepend the widget to
    // the entity's content.
    if (typeof drupalgap.site_settings.rate_widgets === 'undefined') { return; }
    // Iterate over each rate widget...
    $.each(drupalgap.site_settings.rate_widgets, function(id, widget) {
        // Skip this widget if it isn't supported on this entity type.
        if (entity_type == 'node' && $.inArray(bundle, widget.node_types) == -1) { console.log('skipping: ' + bundle); return; }
        else if (entity_type == 'comment' && $.inArray(bundle, widget.comment_types) == -1) { console.log('skipping: ' + bundle); return; }
        // Skip the widget if the current user doesn't have access to it.
        var access = false;
        $.each(Drupal.user.roles, function(rid, role) {
            $.each(widget.roles, function(_rid, __rid) {
                if (rid == _rid && __rid) {
                  access = true;
                  return false;
                }
            });
            if (access) { return false; }
        });
        if (!access) { return; }
        // Render the widget.
        var html = theme(widget.theme, { widget: widget, entity: entity });
        // Depending on the entity type, determine if/how the widget will be
        // displayed.
        // 0 - Do not add automatically
        // 1 - Above the content
        // 2 - Below the content
        var display = null;
        if (entity_type == 'node') { display = 'node_display'; }
        else if (entity_type == 'comment') { display = 'comment_display'; }
        switch (parseInt(widget[display])) {
          case 1: entity.content = html + entity.content; break;
          case 2: entity.content += html; break;
        }
    });
  }
  catch (error) {
    console.log('rate_entity_post_render_content - ' + error);
  }
}

/**
 * Themes a yes/no rate widget.
 */
function theme_rate_template_yesno(variables) {
  try {
    dpm(variables);
    return '<div><h3>' + variables.widget.title + '</h3></div>';
  }
  catch (error) { console.log('rate_template_yesno - ' + error); }
}
