'use strict';

function is_a_farm_no(str){
  return /[A-Z]{2}[0-9]{9}/.test(str);
}

function is_a_number(str){
  return !/\D/.test(str);
}

function is_a_boolean(str)
{
	return true === str || false === str; 
}

module.exports = 
{
	is_a_farm_no : is_a_farm_no,
	is_a_number : is_a_number,
	is_a_boolean : is_a_boolean
	
}