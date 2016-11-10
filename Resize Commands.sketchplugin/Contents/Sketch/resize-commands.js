@import "persistence.js";

var global_context;
var resizeCommandDirections = /[lrtbwhaxy]/g;
var escapedValue;
var resizeCommandPrevValue  = "";

function onResizeCommands(context) {
	global_context = context;
	doc = context.document;
	// check if there are no conflicting characters in the previous input string (else input prompt fails to open)
	try {
		escapedValue = persist.get("resizeCommandPromptValue");
		if(escapedValue.indexOf('.') > -1) { // check if there are dots present
			resizeCommandPrevValue = escapedValue.replace(".",','); // reset . to , again
		} else { // quotes are only added when having one single operation for some reason.
			resizeCommandPrevValue = escapedValue.replace(/(^"|"$)/g, ''); // this removes the quotes
		}
	}
	catch (e) { // else reset history
		persist.set("resizeCommandPromptValue", "");
	}

	// show inputprompt
	doc.showMessage("Valid directions: t  b  l  r  a(ll)  w  h  x  y. Valid operations: +  -  =  *  /  %. ");
	var resizeCommandPrompt = doc.askForUserInput_initialValue("Enter your Resize Commands. For example: lr-10,h=230", resizeCommandPrevValue);

	if (resizeCommandPrompt) {
		// store previous value for later use
		escapedValue = resizeCommandPrompt.replace(",", "."); // workaround since comma's conflict with persistence.js
		persist.set("resizeCommandPromptValue", escapedValue);

		resizeCommandPrompt = resizeCommandPrompt.toString();
		resizeCommandPrompt = resizeCommandPrompt.toLowerCase();
		resizeCommandPrompt = resizeCommandPrompt.replace(/(px)/g, "");
		resizeCommandPrompt = resizeCommandPrompt.replace(/ /g, "");
		resizeCommandPrompt = resizeCommandPrompt.replace(/;/g, ",");

		var amount, operator, operation;
		var num = 1,
		operationArray = [];

		if (resizeCommandPrompt.indexOf(",") > 0) {
			num = resizeCommandPrompt.split(",").length;
			operationArray = resizeCommandPrompt.split(",");
		}
		else {
			operationArray[0] = resizeCommandPrompt;
		}

		// operationArray = array with all the operations that were put in, for example [0]=lr+20,[1]=h/2)
		// operation = one single operation, for example b-30 or lr+20

		for (var i=0; i<operationArray.length; i++) { // loop through every operation in the array
			operation = operationArray[i];

			if (operation.indexOf("*") >= 0)
				checkOperationNotation(operation, amount, "*");
			else if (operation.indexOf("/") >= 0)
				checkOperationNotation(operation, amount, "/");
			else if (operation.indexOf("%") >= 0)
				checkOperationNotation(operation, amount, "%");
			else if (operation.indexOf("=") >= 0)
				checkOperationNotation(operation, amount, "=");
			else {
				amount = operation.replace(resizeCommandDirections, "");

				if (operation.indexOf("-") >= 0) {
					operator = "-";
					amount = amount.split(operator)[1];
					ContractExpand(operation, operator, amount);
				}
				else { //if nothing is used, for example l20, then use expand
					operator = "+";
					ContractExpand(operation, operator, amount);
				}
			}
		}
	}
}

function ContractExpand(operation, operator, amount) {
	var calcAmount = Math.round(amount);

	if(operator == "-")
		calcAmount *= -1;

	for (var i=0; i<operation.match(resizeCommandDirections).length; i++) {
		if (operation[i] == "a")
			resize(global_context,calcAmount,calcAmount,calcAmount,calcAmount);
		else {
			if (operation[i] == "l")
				resize(global_context,0,0,0,calcAmount);
			else if (operation[i] == "x")
				moveObject(amount,0,operator);
			else if (operation[i] == "y")
				moveObject(0,amount,operator);
			else if (operation[i] == "r" || operation[i] == "w")
				resize(global_context,0,calcAmount,0,0);
			else if (operation[i] == "t")
				resize(global_context,calcAmount,0,0,0);
			else if (operation[i] == "b" || operation[i] == "h")
				resize(global_context,0,0,calcAmount,0);
		}
	}
}

function moveObject(xAmount, yAmount,operator) {
	var doc = global_context.document;
	var selection = global_context.selection;

	if(operator == "-") {
		xAmount *= -1;
		yAmount *= -1;
	}

	for (var i=0; i < selection.count(); i++) {
		var layer = selection.objectAtIndex(i);
		var frame = layer.frame();
		var xCurrent = layer.absoluteRect().rulerX();
		var yCurrent = layer.absoluteRect().rulerY();

		xAmount = Number(xAmount);
		yAmount = Number(yAmount);

		layer.absoluteRect().setRulerX( xCurrent + xAmount );
		layer.absoluteRect().setRulerY( yCurrent + yAmount );
	}
	doc.reloadInspector();
}

function checkOperationNotation(operation, amount, operator) {
	// this function checks the difference between two different notations
	// like w20% & w/2 (note the position of the operator)
	amount = operation.replace(resizeCommandDirections, "");

	if (operator != "%")
		amount = amount.split(operator)[1];
	else
		amount = amount.split(operator)[0];

	applyOperation(operation, amount, operator);
}

function applyOperation(operation, amount, operator) { // function is triggered when using operators = / *
	var doc = global_context.document;
	var selection = global_context.selection;
	var calcAmount = Math.round(amount);
	var match = operation.match(/[whxy]/g) || ["w"]; // strip everything, except whxy, width is the default axis

	for (var i=0; i < selection.count(); i++) {
		var layer = selection.objectAtIndex(i);
		var frame = layer.frame();
		calcAmountPercentage = calcAmount / 100;

		for(var j=0; j < match.length; j++) { // loop through all selected objects
			frameHeight = frame.height();
			frameWidth = frame.width();

			// Set width or height =
			if (operator == "=") {
				if(match[j] == 'x')
					layer.absoluteRect().setRulerX(amount);
				if(match[j] == 'y')
					layer.absoluteRect().setRulerY(amount);
				if(match[j] == 'w')
					frame.setWidth(amount);
				if(match[j] == 'h')
					frame.setHeight(amount);
			}
			// Set percentage %
			else if (operator == "%") {
				if(match[j] == 'h')
					frame.setHeight( Math.round(calcAmountPercentage * frameHeight) );
				else
					frame.setWidth( Math.round(calcAmountPercentage * frameWidth) );
			}
			// Divide /
			else if (operator == "/") {
				if(match[j] == 'h')
					frame.setHeight( Math.round(frameHeight/amount) );
				else
					frame.setWidth( Math.round(frameWidth/amount) );
			}
			// Multiply *
			else if (operator == "*") {
				if(match[j] == 'h')
					frame.setHeight(Math.round(frameHeight*amount) );
				else
					frame.setWidth(Math.round(frameWidth*amount) );
			}
		}
	}
	doc.reloadInspector();
}

// Function below is exactly the same as in Keyboard Resize
function resize(context,t,r,b,l) {
	var doc = context.document;
	var selection = context.selection;
	for (var i=0; i < selection.count(); i++) {
		var layer = selection.objectAtIndex(i);
		var frame = layer.frame();

		// Top
		if(t != 0) {
			if (frame.height() + t < 0) {
				var oldHeight = frame.height();
				frame.setHeight(1); // When contracting size prevent object to get a negative height (e.g. -45px).
				frame.setY(frame.y() + oldHeight - 1); // reposition the object
			} else {
				frame.setY(frame.y() - t); // push/pull object to correct position
				frame.setHeight(frame.height() + t);
			}
		}

		// Right
		if(r != 0) {
			frame.setWidth(frame.width() + r);
			if(frame.width() <= 1) { frame.setWidth(1); }
		}

		// Bottom
		if(b != 0) {
			frame.setHeight(frame.height() + b);
			if(frame.height() <= 1) { frame.setHeight(1); }
		}

		// Left
		if(l != 0) {
			if (frame.width() + l < 0) {
				var oldWidth = frame.width();
				frame.setWidth(1);
				frame.setX(frame.x() + oldWidth - 1);
			} else {
				frame.setX(frame.x() - l); // push/pull object to correct position
				frame.setWidth(frame.width() + l);
			}
		}
	}
	doc.reloadInspector();
}
