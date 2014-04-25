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
 * Given a tag, this will load the corresponding rate widget.
 */
function rate_load_widget_from_tag(tag) {
  try {
    var widget = null;
    $.each(drupalgap.site_settings.rate_widgets, function(id, _widget) {
        if (_widget.tag == tag) {
          widget = _widget;
          return false;
        }
    });
    return widget;
  }
  catch (error) { console.log('rate_load_widget_from_tag - ' + error); }
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
 * Given a rate widget, and the value you are looking for, this will return the
 * label for the option.
 */
function rate_widget_option_label(widget, value) {
  try {
    var options = rate_widget_options(widget);
    if (options.length == 0) { return ''; }
    var label = '';
    $.each(options, function(_value, _label) {
        if (value == _value) {
          label = _label;
          return false;
        }
    });
    return label;
  }
  catch (error) { console.log('rate_widget_option_label - ' + error); }
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
 * the incoming variables, as well as the 'entity_type' and 'bundle' property
 * strings.
 */
function theme_rate(variables) {
  try {
    variables.attributes.class += ' rate rate_widget ' + variables.widget.tag + ' ';
    if (typeof variables.attributes['data-role'] === 'undefined') {
      variables.attributes['data-role'] = 'collapsible';
    }
    if (typeof variables.attributes['data-collapsed'] === 'undefined') {
      variables.attributes['data-collapsed'] = 'false';
    }
    var html = theme(variables.widget.theme, variables);
    html += drupalgap_jqm_page_event_script_code({
        page_id: drupalgap_get_page_id(),
        jqm_page_event: 'pageshow',
        jqm_page_event_callback: '_theme_rate_pageshow',
        jqm_page_event_args: JSON.stringify({
            entity_type: variables.entity_type,
            entity_id: variables.entity[entity_primary_key(variables.entity_type)],
            tag: variables.widget.tag
        })
    });
    return html;
  }
  catch (error) { console.log('theme_rate - ' + error); }
}

/**
 *
 */
function _theme_rate_pageshow(options) {
  try {

    // Load the results.
    votingapi_select_votes({
        data: {
          type: 'results',
          criteria: {
            entity_id: options.entity_id,
            entity_type: options.entity_type,
            tag: options.tag
          }
        },
        success: function(results) {
          
          $.each(results, function(index, result){
              // The 'function' property contains the option id at the end of the
              // string. Figure out the option id, then extract the value (the
              // number of ratings).
              var option_id = result['function'].replace(result.value_type + '-', '');
              var value = result.value;
              
              // Append the value onto the label. Determine the selector to the
              // input first, then find the label.
              var selector = '.' + options.tag + ' input[value="' + option_id + '"]';
              $(selector).siblings('label').append(theme('rate_value', {value: value, tag: options.tag}));
          });
          $('.' + options.tag).trigger('create');
          
          // Load the user's votes.
          votingapi_select_votes({
              data: {
                type: 'votes',
                criteria: {
                  entity_id: options.entity_id,
                  entity_type: options.entity_type,
                  tag: options.tag,
                  uid: Drupal.user.uid
                }
              },
              success: function(votes) {
                // If the user rated this widget, highlight their input.
                // @TODO - this probably doesn't work properly for a widget that
                // has multiple anonymous ratings on it.
                if (votes.length == 0) { return; }
                var vote = votes[0];
                var selector = '.' + options.tag + ' input[value="' + vote.value + '"]';
                $(selector).prop("checked", true).checkboxradio("refresh");
                var description_selector = '.' + options.tag + ' .rate_widget_description';
                var label = rate_widget_option_label(rate_load_widget_from_tag(options.tag), vote.value);
                $(description_selector).append(theme('rate_result', { tag: options.tag, label: label })).trigger('create');
              }
          });
          
        }
    });
  }
  catch (error) { console.log('_theme_rate_pageshow - ' + error); }
}

/**
 * Themes a yes/no rate widget.
 */
function theme_rate_template_yesno(variables) {
  try {
    var html = '<div ' + drupalgap_attributes(variables.attributes) + '>' + 
      '<h3>' + variables.widget.title + '</h3>' +
      theme('radios', {
          options: rate_widget_options(variables.widget),
          attributes: {
            onclick: _theme_rate_onclick_handler(variables.widget, variables.entity, variables.entity_type)
          }
      }) +
      /* Leave this class name on the wrapper element. */
      '<div class="rate_widget_description"><p>' + variables.widget.description + '</p></div>' +
    '</div>';
    return html;
  }
  catch (error) { console.log('rate_template_yesno - ' + error); }
}

/**
 * Theme a rate value.
 */
function theme_rate_value(variables) {
  try {
    return '&nbsp;(' + variables.value + ' ' +
      drupalgap_format_plural(variables.value, 'vote', 'votes') +
    ')';
  }
  catch (error) { console.log('theme_rate_value - ' + error); }
}

/**
 * Theme a rate value.
 */
function theme_rate_result(variables) {
  try {
    return "<h4><em>You voted '" + variables.label + "'.</em></h4>";
  }
  catch (error) { console.log('theme_rate_result - ' + error); }
}

