// Holds onto the last value clicked for a tag. Prevents repetitive clicks on
// the same rate input.
var _rate_last_value = [];

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
          
          // Place the result counts on each input label.
          rate_clear_label_results(options.tag);
          $.each(results, function(index, result){
              rate_set_label_result(result, options.tag);
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
                rate_set_user_vote_description(options.tag, vote.value);
                _rate_last_value[options.tag] = vote.value;
              }
          });
          
        }
    });
  }
  catch (error) { console.log('_theme_rate_pageshow - ' + error); }
}

/**
 * Handles clicks on a rate widget.
 */
function _theme_rate_onclick(input, entity_type, entity_id, value_type, tag) {
  try {
    // Grab the value of the rating.
    var value = $(input).val();
    // Don't proceed if the value hasn't changed.
    if (typeof _rate_last_value[tag] !== 'undefined' && _rate_last_value[tag] == value) {
      return;
    }
    // Save the value to prevent click abuse.
    _rate_last_value[tag] = value;
    // Set the vote.
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
        success: function(results) {
          // Now that the vote is done, we've got the new results. Iterate over
          // them and place their counts on each individual label.
          rate_clear_label_results(tag);
          $.each(results[entity_type][entity_id], function(index, result) {
              rate_set_label_result(result, tag);
          });
          $('.' + tag).trigger('create');
          rate_set_user_vote_description(tag, value)
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
 * Given a set vote result option, this will return the option id bundled within.
 */
function rate_get_result_option_id(result) {
  try {
    // The 'function' property contains the option id at the end of the
    // string. Figure out the option id, then extract the value (the
    // number of ratings).
    return result['function'].replace(result.value_type + '-', '');
  }
  catch (error) { console.log('rate_get_result_option_id - ' + error); }
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
 *
 */
function rate_set_label_result(result, tag) {
  try {
    // Append the value onto the label. Determine the selector to the
    // input first, then find the label.
    var option_id = rate_get_result_option_id(result);
    var value = result.value;
    var selector = '.' + tag + ' input[value="' + option_id + '"]';
    $(selector).siblings('label .rate_value').remove();
    $(selector).siblings('label').append(theme('rate_value', {value: value, tag: tag}));
  }
  catch (error) { console.log('rate_set_label_result - ' + error); }
}

/**
 *
 */
function rate_clear_label_results(tag) {
  try {
    $('.' + tag + ' .rate_value').remove();
  }
  catch (error) { console.log('rate_clear_label_results - ' + error); }
}

/**
 *
 */
function rate_set_user_vote_description(tag, value) {
  try {
    var selector = '.' + tag + ' .rate_widget_description';
    var label = rate_widget_option_label(rate_load_widget_from_tag(tag), value);
    $(selector + ' .rate_result').remove();
    $(selector).append(theme('rate_result', { tag: tag, label: label })).trigger('create');
  }
  catch (error) { console.log('rate_set_user_vote_description - ' + error); }
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
    /* Leave this class name on the wrapper element. */
    return '<span class="rate_value"> (' + variables.value + ' ' +
      drupalgap_format_plural(variables.value, 'vote', 'votes') +
    ')</span>';
  }
  catch (error) { console.log('theme_rate_value - ' + error); }
}

/**
 * Theme a rate value.
 */
function theme_rate_result(variables) {
  try {
    /* Leave the class name on the wrapper element. */
    return "<h4 class='rate_result'><em>You voted '" + variables.label + "'.</em></h4>";
  }
  catch (error) { console.log('theme_rate_result - ' + error); }
}

