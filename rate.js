/**
 * Implements hook_entity_post_render_content().
 */
function rate_entity_post_render_content(entity, entity_type, bundle) {
  try {
    if (typeof drupalgap.site_settings.rate_widgets === 'undefined') { return; }

    // Since the rate widget isn't a field, we'll append/prepend the widget to
    // the entity's content.

    // Iterate over each rate widget...
    $.each(drupalgap.site_settings.rate_widgets, function(id, widget) {

        // Skip this widget if it isn't supported on this entity type.
        if (entity_type == 'node' && $.inArray(bundle, widget.node_types) == -1) { return; }
        else if (entity_type == 'comment' && $.inArray(bundle, widget.comment_types) == -1) { return; }

        // Skip the widget if the current user doesn't have access to it.
        // @TODO - add check on the allow_voting_by_author widget property. 
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

        // Render the widget. Depending on the entity type, determine if/where
        // the widget will be displayed.
        // 0 - Do not add automatically
        // 1 - Above the content
        // 2 - Below the content
        var html = theme('rate', { widget: widget, entity: entity, entity_type: entity_type, bundle: bundle });
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
 * Given a rate widget, this will return the 'options' that can be used on the
 * widgets corresponding form element.
 */
function rate_widget_options(widget) {
  try {
    var options = null;
    if (widget.options.length > 0) {
      switch (widget.template) {
        case 'yesno':
          options = {};
          $.each(widget.options, function(index, option) {
              options[option[0]] = option[1];
          });
          break;
        default:
          console.log('WARNING: rate_widget_options  - unsupported template (' + widget.template + ')');
          break;
      }
    }
    return options;
  }
  catch (error) { console.log('rate_widget_options - ' + error); }
}

/**
 * Handles clicks on a rate widget.
 */
function _theme_rate_onclick(input, entity_type, entity_id, value_type, tag) {
  try {
    var value = $(input).val();
    votingapi_set_votes({
        data: {
          votes: [{
            entity_type: entity_type,
            entity_id: entity_id,
            value_type: value_type,
            value: value,
            tag: tag
          }]
        },
        success: function(result) {
          dpm('votingapi_set_votes');
          dpm(result);
        }
    });
  }
  catch (error) { console.log('_theme_rate_onclick - ' + error); }
}

/**
 * Returns a rate widget's onclick handler attribute value string.
 */
function _theme_rate_onclick_handler(widget, entity, entity_type) {
  try {
    return "_theme_rate_onclick(this, '" +
      entity_type + "', " +
      entity[entity_primary_key(entity_type)] + ", " +
      "'" + widget.value_type + "', " +
      "'" + widget.tag + "'" +
    ")";
  }
  catch (error) { console.log('_theme_rate_onclick_handler - ' + error); }
}

/**
 * Themes a rate widget. Expects the 'widget' and 'entity' objects to be set on
 * the incoming variables.
 */
function theme_rate(variables) {
  try {
    variables.attributes.class += ' rate rate_widget ';
    return theme(variables.widget.theme, variables);
  }
  catch (error) { console.log('theme_rate - ' + error); }
}

/**
 * Themes a yes/no rate widget.
 */
function theme_rate_template_yesno(variables) {
  try {
    dpm(variables.widget);
    dpm(variables.entity);
    return '<div ' + drupalgap_attributes(variables.attributes) + '>' + 
      '<h3>' + variables.widget.title + '</h3>' +
      theme('radios', {
          options: rate_widget_options(variables.widget),
          attributes: {
            onclick: _theme_rate_onclick_handler(variables.widget, variables.entity, variables.entity_type)
          }
      }) +
      '<p>' + variables.widget.description + '</p>' +
    '</div>';
  }
  catch (error) { console.log('rate_template_yesno - ' + error); }
}

