/*******************************************************************************
 * Copyright 2014 The MITRE Corporation 
 *   and the MIT Kerberos and Internet Trust Consortium
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *   http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 ******************************************************************************/
var SystemScopeModel = Backbone.Model.extend({
	idAttribute: 'id',

	defaults:{
		id:null,
		description:null,
		icon:null,
		value:null,
		defaultScope:false,
		allowDynReg:false,
		structured:false,
		structuredParamDescription:null,
		structuredValue:null
	},
	
	urlRoot: 'api/scopes'
});

var SystemScopeCollection = Backbone.Collection.extend({
	idAttribute: 'id',
	
	model: SystemScopeModel,
	
	url: 'api/scopes',

	defaultScopes: function() {
		filtered = this.filter(function(scope) {
			return scope.get("defaultScope") === true;
		});
		return new SystemScopeCollection(filtered);
	},
	
	dynRegScopes: function() {
		filtered = this.filter(function(scope) {
			return scope.get("allowDynReg") === true;
		});
		return new SystemScopeCollection(filtered);
	},
	
	defaultDynRegScopes: function() {
		filtered = this.filter(function(scope) {
			return scope.get("defaultScope") === true && scope.get("allowDynReg") === true;
		});
		return new SystemScopeCollection(filtered);		
	},
	
	getByValue: function(value) {
		var scopes = this.where({value: value});
		if (scopes.length == 1) {
			return scopes[0];
		} else {
			return null;
		}
	}
	
});

var SystemScopeView = Backbone.View.extend({
	
	tagName: 'tr',
	
    initialize:function (options) {
    	this.options = options;

        if (!this.template) {
            this.template = _.template($('#tmpl-system-scope').html());
        }

        this.model.bind('change', this.render, this);
        
    },
    
    events: {
		'click .btn-edit':'editScope',
		'click .btn-delete':'deleteScope'
	},
	
	editScope:function(e) {
    	e.preventDefault();
		app.navigate('admin/scope/' + this.model.id, {trigger: true});
	},
	
    render:function (eventName) {
        this.$el.html(this.template(this.model.toJSON()));

        this.$('.allow-dyn-reg').tooltip({title: 'This scope can be used by dynamically registered clients'});
        
        return this;
    },
    
    deleteScope:function (e) {
    	e.preventDefault();

        if (confirm("Are you sure sure you would like to delete this scope? Clients that have this scope will still be able to ask for it.")) {
            var _self = this;

            this.model.destroy({
                success:function () {
                	
                    _self.$el.fadeTo("fast", 0.00, function () { //fade
                        $(this).slideUp("fast", function () { //slide up
                            $(this).remove(); //then remove from the DOM
                            _self.parentView.togglePlaceholder();
                        });
                    });
                },
            	error:function (error, response) {
            		
					//Pull out the response text.
					var responseJson = JSON.parse(response.responseText);
            		
            		//Display an alert with an error message
					$('#modalAlert div.modal-header').html(responseJson.error);
	        		$('#modalAlert div.modal-body').html(responseJson.error_description);
            		
        			 $("#modalAlert").modal({ // wire up the actual modal functionality and show the dialog
        				 "backdrop" : "static",
        				 "keyboard" : true,
        				 "show" : true // ensure the modal is shown immediately
        			 });
            	}
            });

            _self.parentView.delegateEvents();
        }

        return false;
    },
    
    close:function () {
        $(this.el).unbind();
        $(this.el).empty();
    }
});

var SystemScopeListView = Backbone.View.extend({
	tagName: 'span',
	
	initialize:function(options) {
    	this.options = options;
	},
	
	load:function(callback) {
    	if (this.model.isFetched) {
    		callback();
    		return;
    	}

    	$('#loadingbox').sheet('show');
    	$('#loading').html('<span class="label" id="loading-scopes">Scopes</span> ');

    	$.when(this.model.fetchIfNeeded({success:function(e) {$('#loading-scopes').addClass('label-success');}}))
    	.done(function() {
    	    		$('#loadingbox').sheet('hide');
    	    		callback();
    			});    	
    },

    events:{
		"click .new-scope":"newScope",
		"click .refresh-table":"refreshTable"
	},

	newScope:function(e) {
		this.remove();
		app.navigate('admin/scope/new', {trigger: true});
	},
	
	refreshTable:function(e) {
		var _self = this;
    	$('#loadingbox').sheet('show');
    	$('#loading').html('<span class="label" id="loading-scopes">Scopes</span> ');

    	$.when(this.model.fetch({success:function(e) {$('#loading-scopes').addClass('label-success');}}))
    	.done(function() {
    	    		$('#loadingbox').sheet('hide');
    	    		_self.render();
    			});    	
	},
	
	togglePlaceholder:function() {
		if (this.model.length > 0) {
			$('#scope-table', this.el).show();
			$('#scope-table-empty', this.el).hide();
		} else {
			$('#scope-table', this.el).hide();
			$('#scope-table-empty', this.el).show();
		}
	},
	
	render: function (eventName) {
		
		// append and render the table structure
		$(this.el).html($('#tmpl-system-scope-table').html());
		
		var _self = this;
		
		_.each(this.model.models, function (scope) {
			var view = new SystemScopeView({model: scope});
			view.parentView = _self;
			$("#scope-table", _self.el).append(view.render().el);
		}, this);
		
		this.togglePlaceholder();
		
		return this;
	}
});

var SystemScopeFormView = Backbone.View.extend({
	tagName: 'span',
	
	initialize:function(options) {
    	this.options = options;
		if (!this.template) {
            	this.template = _.template($('#tmpl-system-scope-form').html());
		}
		if (!this.iconTemplate) {
			this.iconTemplate = _.template($('#tmpl-system-scope-icon').html());
		}
		
		// initialize our icon set into slices for the selector
		if (!this.bootstrapIcons) {
			this.bootstrapIcons = [];
			
    		var iconList = ['glass', 'music', 'search', 'envelope', 'heart', 'star',
    		                'star-empty', 'user', 'film', 'th-large', 'th', 'th-list', 'ok',
    		                'remove', 'zoom-in', 'zoom-out', 'off', 'signal', 'cog', 'trash',
    		                'home', 'file', 'time', 'road', 'download-alt', 'download',
    		                'upload', 'inbox', 'play-circle', 'repeat', 'refresh', 'list-alt',
    		                'lock', 'flag', 'headphones', 'volume-off', 'volume-down',
    		                'volume-up', 'qrcode', 'barcode', 'tag', 'tags', 'book',
                			'bookmark', 'print', 'camera', 'font', 'bold', 'italic',
                			'text-height', 'text-width', 'align-left', 'align-center',
                			'align-right', 'align-justify', 'list', 'indent-left',
                			'indent-right', 'facetime-video', 'picture', 'pencil',
                			'map-marker', 'tint', 'share', 'move', 'fast-backward', 'backward',
                			'pause', 'stop', 'forward', 'step-forward', 'eject',
                			'chevron-right', 'plus-sign', 'minus-sign', 'remove-sign',
                			'ok-sign', 'question-sign', 'info-sign', 'screenshot',
                			'remove-circle', 'ok-circle', 'ban-circle', 'arrow-left',
                			'arrow-right', 'arrow-down', 'share-alt', 'resize-full',
                			'resize-small', 'plus', 'asterisk', 'exclamation-sign', 'gift',
                			'leaf', 'fire', 'eye-close', 'plane', 'random', 'magnet',
                			'chevron-up', 'chevron-down', 'retweet', 'shopping-cart',
                			'folder-close', 'folder-open', 'resize-vertical',
                			'resize-horizontal', 'hdd', 'bell', 'thumbs-up', 'hand-right',
                			'hand-left', 'hand-down', 'circle-arrow-left', 'circle-arrow-up',
                			'circle-arrow-down', 'globe', 'tasks', 'briefcase' ];
    		
    		var size = 3;
    		while (iconList.length > 0) {
    			this.bootstrapIcons.push(iconList.splice(0, size));
    		}

		}
	},
	
	events:{
		'click .btn-save':'saveScope',
		'click .btn-cancel': function() {app.navigate('admin/scope', {trigger: true}); },
		'click .btn-icon':'selectIcon',
		'change #isStructured input':'toggleStructuredParamDescription'
	},
	
	toggleStructuredParamDescription:function(e) {
		if ($('#isStructured input', this.el).is(':checked')) {
			$('#structuredParamDescription', this.el).show();
		} else {
			$('#structuredParamDescription', this.el).hide();
		}
	},
	
	saveScope:function(e) {
    	e.preventDefault();
		
		var value = $('#value input').val();
		
		if (value == null || value.trim() == "") {
			// error: can't have a blank scope
			return false;
		}
		
		var valid = this.model.set({
			value:value,
			description:$('#description textarea').val(),
			icon:$('#iconDisplay input').val(),
			defaultScope:$('#defaultScope input').is(':checked'),
			allowDynReg:$('#allowDynReg input').is(':checked'),
			structured:$('#isStructured input').is(':checked'),
			structuredParamDescription:$('#structuredParamDescription input').val()
		});
		
		if (valid) {
			
			var _self = this;
			this.model.save({}, {
				success:function() {
					app.systemScopeList.add(_self.model);
					app.navigate('admin/scope', {trigger: true});
				},
				error:function(error, response) {
					
					//Pull out the response text.
					var responseJson = JSON.parse(response.responseText);
	    			
    				//Display an alert with an error message
    				$('#modalAlert div.modal-header').html(responseJson.error);
            		$('#modalAlert div.modal-body').html(responseJson.error_description);
            		
        			 $("#modalAlert").modal({ // wire up the actual modal functionality and show the dialog
        				 "backdrop" : "static",
        				 "keyboard" : true,
        				 "show" : true // ensure the modal is shown immediately
        			 });
	    		}
			});
		}

		return false;
	},
	
	selectIcon:function(e) {
    	e.preventDefault();
		
		var icon = e.target.value;
		
		$('#iconDisplay input').val(icon);
		$('#iconDisplay span').html(icon);
		$('#iconDisplay i').removeClass();
		$('#iconDisplay i').addClass('icon-' + icon);
		
		$('#iconSelector').modal('hide');
		
		return false;
	},
	
	render: function(eventName) {
		this.$el.html(this.template(this.model.toJSON()));
		
		_.each(this.bootstrapIcons, function (items) {
			$(".modal-body", this.el).append(this.iconTemplate({items:items}));
		}, this);
		
		this.toggleStructuredParamDescription();
		
		return this;
	}
});

